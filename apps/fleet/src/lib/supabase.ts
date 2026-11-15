import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import type { LatLon } from "../types";

// Lazy init: evita crear el cliente antes de que validateEnv() pueda validar.
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }
  return _supabase;
}

export const STARTING_POINT: LatLon = [39.8641, -4.0226]; // Toledo
