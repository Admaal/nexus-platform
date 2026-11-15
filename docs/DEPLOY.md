# Despliegue

Dos proyectos en Vercel (tienda y fleet) sobre el mismo repositorio y un proyecto de Supabase.
Sustituye `<project-ref>` por el identificador de tu proyecto Supabase.

## 1. Supabase

```bash
# Secrets de las Edge Functions, despliegue de funciones y migraciones
PROJECT_REF=<project-ref> ORDER_WORKER_SECRET=... SENDER_EMAIL=... BREVO_API_KEY=... \
  FLEET_TRACKING_URL=https://tu-fleet.vercel.app DEMO_TRUCK_ID=... \
  bash scripts/setup-supabase-secrets.sh
```

(En PowerShell: `scripts/setup-supabase-secrets.ps1` con los mismos valores como parámetros.)

El script ejecuta `supabase secrets set`, despliega `order-worker` y `telemetry-ingest` con `--no-verify-jwt` y aplica las migraciones con `supabase db push --linked`.

### Vault: despertar al worker

`place_order` avisa al worker con `pg_net` y un barrido de `pg_cron` lo recoge cada minuto. Ambos leen estos secretos de Vault; créalos **una vez** en el SQL Editor:

```sql
SELECT vault.create_secret('<mismo valor que ORDER_WORKER_SECRET>', 'ORDER_WORKER_SECRET', 'API key del order-worker');
SELECT vault.create_secret('https://<project-ref>.supabase.co/functions/v1/order-worker', 'ORDER_WORKER_URL', 'URL del order-worker');
```

Sin ellos el sistema sigue funcionando, pero la latencia pasa a ser la del barrido (hasta un minuto) y la base de datos solo emite un aviso.

### Correo en la demo pública

Si quieres que la demo no envíe correos reales, configura `EMAIL_PROVIDER=log` (`supabase secrets set EMAIL_PROVIDER=log`). El worker completa el pedido igual y solo deja constancia en el log. Con el valor por defecto (`brevo`) hacen falta `BREVO_API_KEY` y `SENDER_EMAIL` válidos; si Brevo rechaza la clave, el error se clasifica como permanente y el pedido pasa a `FAILED` con el motivo visible.

### Comprobaciones tras desplegar

- `supabase test db` contra una copia local de las mismas migraciones.
- Hacer un pedido y comprobar que la línea temporal llega a «Envío en marcha».
- `select * from cron.job` debe listar `order-worker-sweep` y `telemetry-rate-cleanup`.

## 2. Tienda (Vercel)

| Campo | Valor |
| --- | --- |
| Root Directory | `apps/store` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `cd ../.. && npm install` |

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima del proyecto |
| `VITE_FLEET_URL` | URL de producción de fleet |

## 3. Fleet (Vercel)

| Campo | Valor |
| --- | --- |
| Root Directory | `apps/fleet` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `cd ../.. && npm install` |

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima del proyecto |
| `VITE_TELEMETRY_INGEST_URL` | `https://<project-ref>.supabase.co/functions/v1/telemetry-ingest` |
| `VITE_STORE_URL` | URL de producción de la tienda |
| `VITE_CARTO_API_KEY` | Clave pública de CARTO restringida por dominio |
| `VITE_TRUCK_ID` | Mismo valor que `DEMO_TRUCK_ID` en Supabase |

Solicita la clave en [CARTO Basemaps](https://carto.com/basemaps/apikey/) y restríngela al dominio de producción de fleet y a `localhost:5174`. La clave se expone en el navegador por diseño.

## 4. GitHub Actions

Para el cron de keep-alive, en **Settings → Secrets and variables → Actions**: `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

El flujo `CI` no necesita secretos: levanta su propio Supabase local. Para proteger `main`, exige el check `Gate obligatorio` (ver `AGENTS.md`).
