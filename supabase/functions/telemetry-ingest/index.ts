import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ingestSecret = Deno.env.get("TELEMETRY_INGEST_SECRET") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  if (!ingestSecret) return false;
  return req.headers.get("X-API-Key") === ingestSecret;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await req.json();
    const { truck_id, location, timestamp } = payload;

    if (
      typeof truck_id !== "string" ||
      !truck_id ||
      typeof location?.lat !== "number" ||
      typeof location?.lon !== "number"
    ) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const { error } = await supabase.from("telemetry").insert({
      truck_id,
      lat: location.lat,
      lon: location.lon,
      timestamp: typeof timestamp === "string" ? timestamp : new Date().toISOString(),
    });

    if (error) {
      return jsonResponse({ error: error.message }, 502);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
});
