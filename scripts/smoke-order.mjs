/**
 * Smoke test: anonymous auth + order insert + shipment trigger + process-order
 * Run: node --env-file=apps/store/.env scripts/smoke-order.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? "https://yiarfffsaciuodbplxus.supabase.co";
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
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

const { data: products, error: productsError } = await supabase.from("products").select("id, name").limit(1);
if (productsError || !products?.[0]) {
  console.error("FAIL products:", productsError?.message ?? "catálogo vacío");
  process.exit(1);
}

// El servidor calcula el total con el catálogo: solo se envían ids y cantidades.
const { data: orderId, error: orderError } = await supabase.rpc("place_order", {
  p_items: [{ product_id: products[0].id, quantity: 1 }],
  p_customer_name: "Smoke Test",
  p_customer_email: "smoke@test.local",
  p_shipping_address: "Toledo",
});

if (orderError) {
  console.error("FAIL place_order:", orderError.message);
  process.exit(1);
}
const order = { id: orderId };
console.log("OK order:", order.id);

const { data: shipment } = await supabase.rpc("get_shipment", { p_tracking_id: order.id });
console.log("OK shipment:", shipment?.[0]?.status);

// El trigger de BD despacha process-order; esperamos el resultado.
await new Promise((r) => setTimeout(r, 8000));

let { data: updated } = await supabase
  .from("orders")
  .select("status, invoice_path")
  .eq("id", order.id)
  .single();

if (updated?.status !== "COMPLETED") {
  const { error: retryError } = await supabase.rpc("request_order_processing", { p_order_id: order.id });
  console.log(retryError ? "WARN retry:" : "OK retry solicitado", retryError?.message ?? "");
  await new Promise((r) => setTimeout(r, 8000));
  ({ data: updated } = await supabase
    .from("orders")
    .select("status, invoice_path")
    .eq("id", order.id)
    .single());
}

console.log("Order status:", updated?.status, updated?.invoice_path ? "invoice OK" : "no invoice yet");

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
