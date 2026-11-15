// Worker de pedidos: consume order_events (pgmq), ejecuta los pasos de forma idempotente
// (factura -> email -> envío), reintenta con backoff y manda a la DLQ lo irrecuperable.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  decideOnFailure,
  type ErrorClass,
  type OrderStep,
  pendingSteps,
} from "../../../packages/domain/src/events.ts";
import {
  buildOrderEmail,
  createMailer,
  errorFromStatus,
  type Mailer,
  type OrderRecord,
  renderInvoicePdf,
  StepError,
} from "./adapters.ts";

const MAX_ATTEMPTS = Number(Deno.env.get("ORDER_MAX_ATTEMPTS") ?? "5");
const BATCH_SIZE = 5;
const VISIBILITY_SECONDS = 60;
const TIME_BUDGET_MS = 50_000;
const INVOICE_LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

const workerSecret = Deno.env.get("ORDER_WORKER_SECRET") ?? "";
const fleetTrackingUrl = (Deno.env.get("FLEET_TRACKING_URL") ?? "http://localhost:5174").replace(/\/$/, "");

const supabase: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);
const mailer: Mailer = createMailer((key) => Deno.env.get(key));

interface QueueMessage {
  msg_id: number;
  read_ct: number;
  payload: { event_id: string; type: string; order_id: string; correlation_id: string };
}

function log(level: "info" | "warn" | "error", msg: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level, msg, ...fields }));
}

function storageErrorClass(error: { status?: number; statusCode?: string | number }): ErrorClass {
  const status = Number(error.status ?? error.statusCode);
  return Number.isFinite(status) ? errorFromStatus("storage", status).errorClass : "transient";
}

// ---------- Pasos (cada uno idempotente) ----------
async function stepInvoice(order: OrderRecord): Promise<void> {
  const path = `${order.user_id}/${order.id}.pdf`;
  const pdf = await renderInvoicePdf(order);

  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    throw new StepError(`Subida de factura: ${uploadError.message}`, storageErrorClass(uploadError as never));
  }

  const { error } = await supabase.from("orders").update({ invoice_path: path }).eq("id", order.id);
  if (error) throw new StepError(`Registrar factura: ${error.message}`, "transient");
}

async function stepEmail(order: OrderRecord): Promise<void> {
  const path = `${order.user_id}/${order.id}.pdf`;
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(path, INVOICE_LINK_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new StepError(`Firmar URL de factura: ${error?.message ?? "sin URL"}`, "transient");
  }

  await mailer.send(
    order.customer_email,
    `Factura de tu pedido #${order.id.split("-")[0]?.toUpperCase() ?? order.id}`,
    buildOrderEmail(order, data.signedUrl, `${fleetTrackingUrl}/?tracking_id=${order.id}`),
  );
}

async function stepShipment(order: OrderRecord): Promise<void> {
  const { error } = await supabase.from("shipments").update({ status: "IN_TRANSIT" }).eq("order_id", order.id);
  if (error) throw new StepError(`Actualizar envío: ${error.message}`, "transient");
}

const STEP_HANDLERS: Record<OrderStep, (order: OrderRecord) => Promise<void>> = {
  invoice: stepInvoice,
  email: stepEmail,
  shipment: stepShipment,
};

// ---------- Procesado de un mensaje ----------
async function processOrder(orderId: string, correlationId: string): Promise<void> {
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error) throw new StepError(`Leer pedido: ${error.message}`, "transient");
  if (!order) throw new StepError("Pedido inexistente", "permanent");

  const record = order as OrderRecord;
  if (record.status === "COMPLETED") return;

  await supabase.from("orders").update({ status: "PROCESSING" }).eq("id", orderId).eq("status", "PENDING");

  const { data: doneRows, error: stepsError } = await supabase
    .from("order_event_steps")
    .select("step")
    .eq("order_id", orderId);
  if (stepsError) throw new StepError(`Leer pasos: ${stepsError.message}`, "transient");

  const done = (doneRows ?? []).map((r: { step: string }) => r.step as OrderStep);

  for (const step of pendingSteps(done)) {
    await STEP_HANDLERS[step](record);
    // on conflict do nothing: si otra entrega concurrente ya lo registró, no pasa nada.
    const { error: markError } = await supabase
      .from("order_event_steps")
      .upsert({ order_id: orderId, step }, { onConflict: "order_id,step", ignoreDuplicates: true });
    if (markError) throw new StepError(`Registrar paso ${step}: ${markError.message}`, "transient");
    log("info", "step.done", { correlation_id: correlationId, order_id: orderId, step });
  }

  const { error: completeError } = await supabase
    .from("orders")
    .update({ status: "COMPLETED", failure_reason: null })
    .eq("id", orderId);
  if (completeError) throw new StepError(`Completar pedido: ${completeError.message}`, "transient");
}

async function handleMessage(msg: QueueMessage): Promise<"ack" | "retry" | "dead-letter"> {
  const { order_id: orderId, correlation_id: correlationId } = msg.payload;
  const base = { correlation_id: correlationId, order_id: orderId, attempt: msg.read_ct };

  try {
    await processOrder(orderId, correlationId);
    await supabase.rpc("worker_ack_event", { p_msg_id: msg.msg_id });
    log("info", "order.completed", base);
    return "ack";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorClass: ErrorClass = error instanceof StepError ? error.errorClass : "transient";
    const decision = decideOnFailure({ readCount: msg.read_ct, maxAttempts: MAX_ATTEMPTS, errorClass });

    if (decision.action === "retry") {
      await supabase.rpc("worker_retry_event", { p_msg_id: msg.msg_id, p_delay_seconds: decision.delaySeconds });
      log("warn", "order.retry", { ...base, error: message, error_class: errorClass, delay_seconds: decision.delaySeconds });
      return "retry";
    }

    await supabase.rpc("worker_dead_letter", {
      p_msg_id: msg.msg_id,
      p_payload: msg.payload,
      p_reason: decision.reason,
      p_error: message,
    });
    log("error", "order.dead_letter", { ...base, error: message, error_class: errorClass, reason: decision.reason });
    return "dead-letter";
  }
}

// ---------- HTTP ----------
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  if (!workerSecret || req.headers.get("X-API-Key") !== workerSecret) return json({ error: "Unauthorized" }, 401);

  const started = Date.now();
  const totals = { ack: 0, retry: 0, "dead-letter": 0 };

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data, error } = await supabase.rpc("worker_read_events", {
      p_qty: BATCH_SIZE,
      p_visibility_seconds: VISIBILITY_SECONDS,
    });
    if (error) {
      log("error", "queue.read_failed", { error: error.message });
      return json({ error: error.message, ...totals }, 502);
    }

    const messages = (data ?? []) as QueueMessage[];
    if (messages.length === 0) break;

    for (const msg of messages) totals[await handleMessage(msg)]++;
  }

  return json({ success: true, ...totals });
});
