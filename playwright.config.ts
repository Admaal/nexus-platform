import { defineConfig } from '@playwright/test'

// Entorno: lo inyecta scripts/run-e2e.mjs a partir de `supabase status` (o el CI).
const supabaseUrl = process.env['SUPABASE_URL'] ?? 'http://127.0.0.1:54321'
const anonKey = process.env['ANON_KEY'] ?? ''

const storeEnv = {
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_ANON_KEY: anonKey,
  VITE_FLEET_URL: 'http://localhost:5174',
}
const fleetEnv = {
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_ANON_KEY: anonKey,
  VITE_TELEMETRY_INGEST_URL: `${supabaseUrl}/functions/v1/telemetry-ingest`,
  VITE_TRUCK_ID: 'demo-truck-1',
}

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev -w @nexus/store',
      url: 'http://localhost:5173',
      env: storeEnv,
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w @nexus/fleet',
      url: 'http://localhost:5174',
      env: fleetEnv,
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
  ],
})
