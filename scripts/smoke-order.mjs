/**
 * Smoke test: anonymous auth + order insert + shipment trigger + process-order
 * Run: node --env-file=apps/store/.env scripts/smoke-order.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? "https://yiarfffsaciuodbplxus.supabase.co";
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const processOrderSecret = process.env.VITE_PROCESS_ORDER_SECRET;
const telemetrySecret = process.env.VITE_TELEMETRY_INGEST_SECRET;

if (!anonKey) {
  console.error("Set VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
if (authError) {
  console.error("FAIL auth:", authError.message);
  process.exit(1);
}
console.log("OK auth:", authData.user?.id, "anonymous=", authData.user?.is_anonymous);

const userId = authData.user.id;
const { data: order, error: orderError } = await supabase
  .from("orders")
  .insert({
    customer_email: "smoke@test.local",
    customer_name: "Smoke Test",
    shipping_address: "Toledo",
    items: [{ name: "Teclado Mecánico Pro", price: 189.5, quantity: 1 }],
    total: 189.5,
    user_id: userId,
  })
  .select()
  .single();

if (orderError) {
  console.error("FAIL order:", orderError.message);
  process.exit(1);
}
console.log("OK order:", order.id);

const { data: shipment } = await supabase
  .from("shipments")
  .select("order_id, status")
  .eq("order_id", order.id)
  .single();
console.log("OK shipment:", shipment?.status);

// Wait for DB trigger to process order
await new Promise((r) => setTimeout(r, 8000));

let { data: updated } = await supabase
  .from("orders")
  .select("status, invoice_url")
  .eq("id", order.id)
  .single();

if (updated?.status !== "COMPLETED" && processOrderSecret) {
  const res = await fetch(`${url}/functions/v1/process-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": processOrderSecret,
    },
    body: JSON.stringify({ order_id: order.id }),
  });
  const body = await res.text();
  console.log(res.ok ? "OK process-order:" : "WARN process-order:", res.status, body.slice(0, 120));

  ({ data: updated } = await supabase
    .from("orders")
    .select("status, invoice_url")
    .eq("id", order.id)
    .single());
}

console.log("Order status:", updated?.status, updated?.invoice_url ? "invoice OK" : "no invoice yet");

const telemetryUrl = process.env.VITE_TELEMETRY_INGEST_URL
  ?? `${url}/functions/v1/telemetry-ingest`;

if (!telemetrySecret) {
  console.warn("WARN telemetry: VITE_TELEMETRY_INGEST_SECRET not set");
} else {
  const telemetryRes = await fetch(telemetryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": telemetrySecret,
    },
    body: JSON.stringify({
      truck_id: order.id,
      location: { lat: 39.86, lon: -4.02 },
      timestamp: new Date().toISOString(),
    }),
  });
  const telemetryBody = await telemetryRes.text();
  console.log(telemetryRes.ok ? "OK telemetry:" : "WARN telemetry:", telemetryRes.status, telemetryBody);
}
