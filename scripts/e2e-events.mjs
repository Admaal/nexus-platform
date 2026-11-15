/**
 * E2E local del flujo por eventos (requiere `supabase start` y `supabase functions serve`).
 *
 *   ANON_KEY=... SERVICE_ROLE_KEY=... ORDER_WORKER_SECRET=local-worker-secret \
 *     node scripts/e2e-events.mjs
 *
 * Comprueba: place_order -> cola -> worker -> pasos -> factura firmada, idempotencia al
 * reprocesar y la ingesta de telemetría (validación, camión desconocido, rate limit).
 */
import { createClient } from "@supabase/supabase-js";

const API = process.env.LOCAL_API_URL ?? "http://127.0.0.1:54321";
const { ANON_KEY, SERVICE_ROLE_KEY, ORDER_WORKER_SECRET = "local-worker-secret" } = process.env;
if (!ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("Define ANON_KEY y SERVICE_ROLE_KEY (salida de `supabase status`).");
  process.exit(1);
}

let failures = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const user = createClient(API, ANON_KEY);
const admin = createClient(API, SERVICE_ROLE_KEY);

const kickWorker = () =>
  fetch(`${API}/functions/v1/order-worker`, {
    method: "POST",
    headers: { "X-API-Key": ORDER_WORKER_SECRET, "Content-Type": "application/json" },
    body: "{}",
  }).then((r) => r.json());

async function waitForStatus(orderId, status, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { data } = await admin.from("orders").select("status, invoice_path, failure_reason").eq("id", orderId).single();
    if (data?.status === status) return data;
    await sleep(500);
  }
  return null;
}

// ---------- Pedido ----------
const { error: authError } = await user.auth.signInAnonymously();
check(!authError, "auth anónima", authError?.message);

const { data: products } = await user.from("products").select("id").limit(2);
const { data: orderId, error: orderError } = await user.rpc("place_order", {
  p_items: products.map((p) => ({ product_id: p.id, quantity: 1 })),
  p_customer_name: "E2E",
  p_customer_email: "e2e@test.local",
  p_shipping_address: "Toledo",
});
check(!orderError && !!orderId, "place_order", orderError?.message);

const unauthWorker = await fetch(`${API}/functions/v1/order-worker`, { method: "POST", body: "{}" });
check(unauthWorker.status === 401, "worker rechaza llamadas sin clave", `status ${unauthWorker.status}`);

console.log("worker:", JSON.stringify(await kickWorker()));
const completed = await waitForStatus(orderId, "COMPLETED");
check(!!completed, "pedido COMPLETED", completed ? "" : "timeout");

const { data: steps } = await admin.from("order_event_steps").select("step").eq("order_id", orderId);
check(steps?.length === 3, "3 pasos registrados", steps?.map((s) => s.step).join(","));

if (completed?.invoice_path) {
  const { data: signed } = await user.storage.from("invoices").createSignedUrl(completed.invoice_path, 60);
  const pdf = signed ? await fetch(signed.signedUrl) : null;
  check(pdf?.ok && (await pdf.arrayBuffer()).byteLength > 500, "factura descargable con URL firmada");
}

const publicUrl = `${API}/storage/v1/object/public/invoices/${completed?.invoice_path}`;
check((await fetch(publicUrl)).status >= 400, "la factura NO es pública");

// ---------- Idempotencia: reabrir el pedido y reprocesar no repite pasos ----------
await admin.from("orders").update({ status: "PENDING" }).eq("id", orderId);
await user.rpc("request_order_processing", { p_order_id: orderId });
console.log("worker (redrive):", JSON.stringify(await kickWorker()));
const again = await waitForStatus(orderId, "COMPLETED");
const { data: stepsAfter } = await admin.from("order_event_steps").select("step, completed_at").eq("order_id", orderId);
check(!!again && stepsAfter?.length === 3, "reprocesar deja el pedido COMPLETED con 3 pasos");

// ---------- Telemetría ----------
const post = (body) =>
  fetch(`${API}/functions/v1/telemetry-ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

check((await post({ truck_id: orderId, location: { lat: 39.86, lon: -4.02 } })).status === 200, "telemetría válida aceptada");
check((await post({ truck_id: orderId, location: { lat: 999, lon: -4.02 } })).status === 400, "lat fuera de rango rechazada (400)");
check((await post({ truck_id: "no-existe", location: { lat: 1, lon: 1 } })).status === 404, "camión desconocido rechazado (404)");
check((await post({ truck_id: "demo-truck-1", location: { lat: 39.86, lon: -4.02 } })).status === 200, "camión demo aceptado");

let limited = false;
for (let i = 0; i < 70 && !limited; i++) {
  limited = (await post({ truck_id: orderId, location: { lat: 39.86, lon: -4.02 } })).status === 429;
}
check(limited, "rate limit devuelve 429 al superar el límite");

console.log(failures === 0 ? "\nE2E OK" : `\nE2E con ${failures} fallo(s)`);
process.exit(failures === 0 ? 0 : 1);
