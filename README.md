# Nexus Platform

Monorepo de portfolio: **tienda e-commerce** + **panel de telemetría en tiempo real**, con backend unificado en Supabase.

> Demo pública con auth anónima y datos de prueba. No uses datos personales reales.

## Arquitectura

```
apps/store  →  RPC place_order  →  orders + evento order.created (pgmq, misma transacción)
                                         ↓
                      Edge Function order-worker (reintentos con backoff, DLQ)
                        factura PDF → email → envío   (pasos idempotentes)
                                                      ↓
apps/fleet  ←  Realtime telemetry  ←  Edge Function telemetry-ingest  ←  simulador GPS
```

Tracking: `apps/fleet/?tracking_id=<order_id>` (mismo UUID que el pedido).

## Stack

| Capa    | Tecnología                                                   |
| ------- | ------------------------------------------------------------ |
| Store   | React + Vite                                                 |
| Fleet   | React + Vite + Leaflet                                       |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, Realtime) |
| Email   | Brevo API                                                    |
| Deploy  | Vercel (2 proyectos) + GitHub Actions (keep-alive)           |

## Setup local

```bash
git clone https://github.com/Admaal/nexus-platform.git
cd nexus-platform
npm install

cp apps/store/.env.example apps/store/.env
cp apps/fleet/.env.example apps/fleet/.env
# Rellena VITE_SUPABASE_ANON_KEY y los secrets (ver abajo)

npm run dev          # store :5173 + fleet :5174
```

## Variables de entorno

### Apps (`.env` locales)

| Variable                       | App          | Descripción                   |
| ------------------------------ | ------------ | ----------------------------- |
| `VITE_SUPABASE_URL`            | store, fleet | URL del proyecto Supabase     |
| `VITE_SUPABASE_ANON_KEY`       | store, fleet | Anon key (pública, con RLS)   |
| `VITE_FLEET_URL`               | store        | URL de fleet (local o Vercel) |
| `VITE_TELEMETRY_INGEST_URL`    | fleet        | URL de `telemetry-ingest`     |
| `VITE_TRUCK_ID`                | fleet        | UUID demo sin `?tracking_id=` |

### Supabase Edge Function secrets

Ver [`supabase/.env.secrets.example`](supabase/.env.secrets.example). Configurar con:

```bash
npx supabase secrets set --project-ref yiarfffsaciuodbplxus \
  BREVO_API_KEY="xkeysib-..." \
  SENDER_EMAIL="tu_email@dominio.com" \
  ORDER_WORKER_SECRET="secreto_largo_aleatorio" \
  DEMO_TRUCK_ID="00000000-0000-4000-8000-000000000001" \
  FLEET_TRACKING_URL="https://tu-fleet.vercel.app"
```

### Vault (despertar al worker al crear un pedido)

`place_order` encola el evento y avisa al worker con `pg_net`; un barrido de `pg_cron` cada minuto recoge lo que se pierda. Ambos leen `ORDER_WORKER_SECRET` y `ORDER_WORKER_URL` de Supabase Vault. Ejecuta **una vez** en SQL Editor:

```sql
SELECT vault.create_secret('TU_ORDER_WORKER_SECRET', 'ORDER_WORKER_SECRET', 'API key del order-worker');
SELECT vault.create_secret('https://<project-ref>.supabase.co/functions/v1/order-worker', 'ORDER_WORKER_URL', 'URL del order-worker');
```

`ORDER_WORKER_SECRET` debe coincidir con el de Edge Function secrets. El navegador no conoce ningún secreto: los pedidos se crean con la RPC `place_order` y el reproceso con `request_order_processing`.

## Despliegue

Guía completa: [`docs/DEPLOY.md`](docs/DEPLOY.md)

- **GitHub:** repo monorepo con workflows en `.github/workflows/`
- **Vercel:** 2 proyectos (`apps/store` y `apps/fleet`)
- **Keep-alive:** cron cada 12h vía GitHub Actions (secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`)

## Seguridad (portfolio)

- `order-worker` protegido con `X-API-Key` (`ORDER_WORKER_SECRET`); la cola solo es accesible con `service_role`
- RLS en tablas de negocio; telemetría INSERT solo vía service role
- Auth anónima: cualquier visitante puede crear pedidos demo
- `orders` sin INSERT directo: el total se calcula en servidor (`place_order`) con los precios del catálogo
- `shipments` solo legible por su propietario o vía `get_shipment(tracking_id)`
- Bucket `invoices` privado (`{user_id}/{order_id}.pdf`), accesible con URLs firmadas que caducan
- `telemetry-ingest` es público por diseño (demo, el simulador corre en el navegador): valida con Zod, solo acepta camiones conocidos (pedidos existentes o `DEMO_TRUCK_ID`) y limita a 60 pings/min por camión

**Nunca commitear:** `.env`, `service_role`, `BREVO_API_KEY`, ni archivos en `supabase/.temp/`

## Scripts

| Comando                                                   | Descripción                  |
| --------------------------------------------------------- | ---------------------------- |
| `npm run dev`                                             | Store + fleet en paralelo    |
| `npm run dev:store`                                       | Solo tienda (:5173)          |
| `npm run dev:fleet`                                       | Solo fleet (:5174)           |
| `npm run build:store` / `build:fleet`                     | Builds de producción         |
| `npm run test:db`                                         | Tests pgTAP (RLS, cola, DLQ) |
| `node scripts/e2e-events.mjs`                             | E2E local del flujo (ver cabecera) |

## Migraciones

```bash
npx supabase link --project-ref yiarfffsaciuodbplxus
npx supabase db push
npx supabase functions deploy order-worker --no-verify-jwt
npx supabase functions deploy telemetry-ingest --no-verify-jwt
```

## Licencia

MIT
