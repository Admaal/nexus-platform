// Ingesta de telemetría del simulador. Es pública por diseño (demo): la defensa no es un secreto
// en el navegador sino (1) validación estricta, (2) solo camiones conocidos y (3) límite por camión.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";

const RATE_LIMIT_PER_MINUTE = Number(Deno.env.get("TELEMETRY_RATE_LIMIT") ?? "60");
const demoTruckId = Deno.env.get("DEMO_TRUCK_ID") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

const payloadSchema = z.object({
  truck_id: z.string().min(1).max(64),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  timestamp: z.iso.datetime({ offset: true }).optional(),
});

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

async function isKnownTruck(truckId: string): Promise<boolean> {
  if (demoTruckId && truckId === demoTruckId) return true;
  if (!z.uuid().safeParse(truckId).success) return false;
  const { data, error } = await supabase.from("orders").select("id").eq("id", truckId).maybeSingle();
  return !error && data !== null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method Not Allowed" }, 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "Invalid payload", issues: parsed.error.issues.map((i) => i.path.join(".")) }, 400);
  }
  const { truck_id, location, timestamp } = parsed.data;

  if (!(await isKnownTruck(truck_id))) return jsonResponse({ error: "Unknown truck" }, 404);

  const { data: allowed, error: rateError } = await supabase.rpc("telemetry_rate_ok", {
    p_truck_id: truck_id,
    p_limit: RATE_LIMIT_PER_MINUTE,
    p_window_seconds: 60,
  });
  if (rateError) return jsonResponse({ error: "Rate limiter unavailable" }, 503);
  if (allowed !== true) return jsonResponse({ error: "Too Many Requests" }, 429, { "Retry-After": "60" });

  const { error } = await supabase.from("telemetry").insert({
    truck_id,
    lat: location.lat,
    lon: location.lon,
    timestamp: timestamp ?? new Date().toISOString(),
  });
  if (error) return jsonResponse({ error: error.message }, 502);

  return jsonResponse({ success: true });
});
