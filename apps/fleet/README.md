# NexusLogistics — Panel de telemetría

Panel de control geoespacial en tiempo real para el monorepo **Nexus Platform**.

## Arquitectura

```
Frontend (React + Leaflet)
    │ POST telemetría
    ▼
Supabase Edge Function: telemetry-ingest
    │ INSERT
    ▼
PostgreSQL + PostGIS → Realtime → mapa
```

La ingesta GPS pasa por la Edge Function `telemetry-ingest` (autenticación con `X-API-Key`, validación y escritura en Supabase). El frontend se suscribe por WebSocket a los cambios en la tabla `telemetry`.

## Variables de entorno

Copia `.env.example` a `.env`:

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key |
| `VITE_TELEMETRY_INGEST_URL` | URL de `telemetry-ingest` |
| `VITE_TELEMETRY_INGEST_SECRET` | API key para la ingesta |
| `VITE_TRUCK_ID` | UUID demo sin `?tracking_id=` |

## Desarrollo local

Desde la raíz del monorepo:

```bash
npm run dev:fleet
```

Abre [http://localhost:5174](http://localhost:5174). Con `?tracking_id=<order_id>` enlazas un pedido de la store.

## Simulación

**Iniciar Viaje** recorre coordenadas del trayecto Toledo → Peligros y envía pings cada 2 s a `telemetry-ingest`. Supabase Realtime actualiza el mapa al instante.
