/**
 * Lanza Playwright contra el Supabase local.
 * Requisitos: `supabase start` y `supabase functions serve --env-file <env con EMAIL_PROVIDER=log,
 * ORDER_WORKER_SECRET=local-worker-secret, DEMO_TRUCK_ID=demo-truck-1>`.
 * En CI las variables ya vienen definidas y no se consulta `supabase status`.
 */
import { execFileSync, spawnSync } from "node:child_process";

const env = { ...process.env };

if (!env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
  const status = execFileSync("npx", ["supabase", "status", "-o", "env"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "ignore"],
  });
  for (const line of status.split("\n")) {
    const match = line.match(/^([A-Z_]+)="(.*)"$/);
    if (match) env[match[1] === "API_URL" ? "SUPABASE_URL" : match[1]] = match[2];
  }
}
env.ORDER_WORKER_SECRET ??= "local-worker-secret";

const probe = await fetch(`${env.SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1/order-worker`, {
  method: "POST",
}).catch(() => null);
if (!probe || probe.status !== 401) {
  console.error("order-worker no responde: ejecuta `supabase functions serve --env-file ...` (ver cabecera).");
  process.exit(1);
}

const result = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
