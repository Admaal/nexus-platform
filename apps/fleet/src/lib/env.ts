export const env = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  TELEMETRY_INGEST_URL: import.meta.env.VITE_TELEMETRY_INGEST_URL,
  CARTO_API_KEY: import.meta.env.VITE_CARTO_API_KEY,
  TRUCK_ID: import.meta.env.VITE_TRUCK_ID,
  STORE_URL: (import.meta.env.VITE_STORE_URL ?? "http://localhost:5173").replace(/\/$/, ""),
};

const VAR_NAMES = {
  SUPABASE_URL: "VITE_SUPABASE_URL",
  SUPABASE_ANON_KEY: "VITE_SUPABASE_ANON_KEY",
  TELEMETRY_INGEST_URL: "VITE_TELEMETRY_INGEST_URL",
  TRUCK_ID: "VITE_TRUCK_ID",
} as const;

/** Valida que todas las variables de entorno requeridas existan. */
export function validateEnv(): void {
  const missing = (Object.keys(VAR_NAMES) as (keyof typeof VAR_NAMES)[])
    .filter((key) => !env[key])
    .map((key) => VAR_NAMES[key]);

  if (missing.length === 0) return;

  throw new Error(
    `Faltan ${missing.length} variable(s) de entorno requerida(s):\n\n` +
      missing.map((v) => `  - ${v}`).join("\n") +
      '\n\nCopia ".env.example" a ".env" y rellena los valores.',
  );
}
