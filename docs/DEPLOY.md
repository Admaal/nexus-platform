# Despliegue en Vercel (monorepo)

Dos proyectos Vercel apuntando al **mismo repositorio** de GitHub.

## Proyecto 1: Store (tienda)

| Campo | Valor |
|-------|-------|
| Root Directory | `apps/store` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `cd ../.. && npm install` |

**Environment variables:**

| Variable | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://yiarfffsaciuodbplxus.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key del proyecto Supabase |
| `VITE_FLEET_URL` | URL de producción de fleet (ej. `https://nexus-fleet.vercel.app`) |
| `VITE_PROCESS_ORDER_SECRET` | Mismo valor que `PROCESS_ORDER_SECRET` en Supabase |

## Proyecto 2: Fleet (telemetría)

| Campo | Valor |
|-------|-------|
| Root Directory | `apps/fleet` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `cd ../.. && npm install` |

**Environment variables:**

| Variable | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://yiarfffsaciuodbplxus.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key del proyecto Supabase |
| `VITE_TELEMETRY_INGEST_URL` | `https://yiarfffsaciuodbplxus.supabase.co/functions/v1/telemetry-ingest` |
| `VITE_TELEMETRY_INGEST_SECRET` | Mismo valor que `TELEMETRY_INGEST_SECRET` en Supabase |
| `VITE_TRUCK_ID` | `00000000-0000-4000-8000-000000000001` |

## Después del deploy

Actualiza el secret de Supabase para emails de tracking:

```bash
npx supabase secrets set --project-ref yiarfffsaciuodbplxus \
  FLEET_TRACKING_URL="https://tu-fleet.vercel.app"
```

## GitHub Actions secrets (repo monorepo)

En **Settings → Secrets and variables → Actions**:

- `SUPABASE_URL` — `https://yiarfffsaciuodbplxus.supabase.co`
- `SUPABASE_ANON_KEY` — anon key
