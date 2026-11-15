/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_TELEMETRY_INGEST_URL: string
  readonly VITE_TELEMETRY_INGEST_SECRET: string
  readonly VITE_TRUCK_ID: string
  readonly VITE_CARTO_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
