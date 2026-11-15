# Plan: Nexus Platform → escaparate event-driven (Opción A de la auditoría)

## Contexto
La auditoría (14/11/2026) puntúa Nexus 5/10: JavaScript, sin CI, tests triviales (iconos/constantes), 3 commits y políticas demasiado abiertas. Recomienda convertirlo en el proyecto público que demuestre lo que haces en Ready GO: eventos, colas, idempotencia, reintentos, DLQ. Objetivo: 8,5–9/10, coherente con el CV («Backend & Cloud Engineer»).

Fuera de este repo (no entra aquí): CV, web Admaalfolio, README de perfil, LinkedIn, PropTech, Resolvo.

## Problemas encontrados en el código (además de la auditoría)
1. **Precio confiado al cliente**: `useOrders.createOrder` calcula `total` y `items[].price` en el navegador y la Edge Function los usa tal cual → cualquiera crea pedidos a 0 €. El total debe calcularse en servidor desde `products`.
2. **Secretos en el frontend**: `VITE_PROCESS_ORDER_SECRET` y `VITE_TELEMETRY_INGEST_SECRET` van en el bundle → la API key no protege nada.
3. **Doble disparo y reintentos en el navegador**: trigger `pg_net` + llamada desde `createOrder` + `useOrders` reintentando PENDING cada 5 s desde cada pestaña abierta.
4. **Idempotencia con carrera**: `process-order` hace check-then-act; dos llamadas concurrentes generan dos PDF y dos emails.
5. **Errores silenciados**: el `upload` del PDF y los `update` no comprueban `error`; el pedido acaba `COMPLETED` aunque falle.
6. **Inyección HTML en el email**: `customer_name`/`items[].name` se interpolan sin escapar.
7. **RLS**: `shipments` usa `USING (true OR …)` y `telemetry` es legible por todos; bucket `invoices` público + `getPublicUrl`.
8. **URL del proyecto fija** en la migración del trigger (`yiarfffsaciuodbplxus`).
9. `process-order` es un fichero de 230 líneas que mezcla HTTP, PDF, storage, email y estado: sin capas ni tests.
10. Deps de Deno viejas (`std@0.168.0`, `supabase-js@2.39.3`).

## Arquitectura objetivo
```
store ──RPC place_order(items)──▶ Postgres: orders + outbox (misma transacción)
                                         │ pgmq: order_events
                                         ▼
                        worker (Edge Function, cron/pg_net)
                     ├─ generate-invoice  (idempotente por order_id)
                     ├─ send-email        (idempotente, reintentos con backoff)
                     └─ start-shipment
                     fallo permanente / N reintentos → order_events_dlq
fleet ◀─ Realtime ── telemetry ◀── telemetry-ingest (Zod + rate limit) ◀── simulador (servidor)
```
Cola: **Supabase Queues (pgmq)** — se queda en el mismo stack, gratis, y cuenta la misma historia que Pub/Sub. Un ADR explica por qué pgmq y cómo se mapearía a Pub/Sub.

Capas en `supabase/functions/_shared/` y paquete `packages/domain`: dominio puro (cálculo de pedido, máquina de estados del pedido/envío, clasificación de errores transitorio/permanente), puertos (`InvoiceRenderer`, `Mailer`, `Storage`, `OrderRepo`, `Queue`) y adaptadores (pdf-lib, Brevo, Supabase).

## Fases (cada una = rama + PR pequeña con CI verde, trabajo en público)

**F0 · Base y valla** (la valla aún no existe: cargar skill `valla` al empezar)
- TypeScript estricto en `apps/store`, `apps/fleet` y Edge Functions (migración progresiva `.jsx→.tsx`, `allowJs` temporal).
- GitHub Actions: lint, typecheck, test, build por workspace + `deno check`/`deno test` de funciones. Badge en README.
- Mover `.claude/`, `CLAUDE.md`, `AGENTS.md` a `docs/ai/` o explicarlos en «Cómo trabajo con IA».

**F1 · Seguridad y dominio en servidor**
- RPC `place_order(items jsonb, customer jsonb)` `SECURITY DEFINER`: valida stock/ids, calcula precios desde `products`, inserta pedido. Revocar INSERT directo en `orders`.
- `shipments`: quitar `true OR`; lectura pública solo vía RPC `get_shipment(tracking_id)`. `telemetry`: lectura vía RPC filtrada por `truck_id`.
- Bucket `invoices` privado + `createSignedUrl` con caducidad.
- Eliminar `VITE_*_SECRET` del frontend; URL del proyecto desde Vault/config, no hardcodeada.
- Tests: pgTAP de políticas RLS (anon no lista shipments ajenos; no se puede insertar un pedido con precio manipulado).

**F2 · Flujo por eventos**
- Migración: extensión `pgmq`, colas `order_events` y `order_events_dlq`, tabla `outbox`/`processed_events (event_id, step)` para idempotencia.
- `place_order` encola `order.created` en la misma transacción.
- Worker: lee lotes, ejecuta pasos idempotentes, `visibility timeout` + backoff, tras N intentos o error permanente → DLQ. Correlation ID en logs JSON.
- Quitar el trigger `pg_net` directo, el disparo desde `createOrder` y el polling de PENDING en `useOrders`.
- Escapar HTML en el email; Zod en `telemetry-ingest` y rate limit por `truck_id`.

**F3 · Tests reales**
- Unitarios del dominio (Vitest): cálculo de pedido, transiciones de estado, clasificación de errores. Mutation testing con Stryker (umbral 75 %, como en el trabajo).
- Integración del worker con Supabase local (`supabase start`): idempotencia (mismo evento 2 veces → 1 email), reintento → DLQ.
- E2E Playwright: compra → factura → tracking en fleet.
- Borrar/reescribir los tests de iconos y constantes que no aportan.

**F4 · Diseño y producto**
- Panel «Cómo funciona» en la tienda tras comprar: línea temporal en vivo del pedido (`order.created → invoice.generated → email.sent → shipment.started`) vía Realtime. Hace visible la arquitectura a un reclutador en 10 s.
- Tokens de diseño compartidos (`packages/ui`: colores, tipografía, espaciado) para que store y fleet se vean como un producto.
- Estados de carga/vacío/error cuidados, foco y contraste AA, `prefers-reduced-motion`.
- Fleet: estado del envío y del pedido junto al mapa; enlace de vuelta a la tienda.
- Página DLQ de solo lectura (o sección en fleet) mostrando eventos fallidos y reintentarlos: demuestra operabilidad.

**F5 · README para personas**
- Capturas/GIF de 60 s, badges (CI, cobertura, licencia), diagrama de secuencia del pedido (Mermaid), diagrama hexagonal, tabla de decisiones (enlazando ADRs en `docs/adr/`: pgmq vs Pub/Sub, RPC vs RLS en tabla, outbox, idempotencia).
- Comandos de despliegue a `docs/DEPLOY.md`; quitar el project-ref del README.
- Descripción, topics y URL de demo en GitHub; corregir el badge de lenguaje del perfil.

## Ficheros clave
- `supabase/functions/process-order/index.ts` → se divide en worker + `_shared/` (dominio, puertos, adaptadores)
- `supabase/functions/telemetry-ingest/index.ts` (Zod, rate limit)
- `supabase/migrations/*` nuevas: `place_order`, RLS, pgmq/outbox, bucket privado
- `apps/store/src/hooks/useOrders.js`, `lib/processOrder.js` (se elimina), `pages/CheckoutPage.jsx`
- `apps/fleet/src/hooks/useSimulation.js` (sin secreto en cliente), `useSupabaseRealtime.js`
- `.github/workflows/ci.yml` (nuevo)

## Verificación
- CI verde en cada PR (lint, typecheck, unit, Stryker ≥75 %, deno test, e2e).
- `supabase start` + `supabase test db` (pgTAP) para RLS.
- E2E Playwright: compra → evento → factura firmada → tracking en fleet.
- Manual: forzar fallo de Brevo → reintentos → mensaje en DLQ visible en el panel; reenviar el mismo evento → un solo email.
- `scripts/smoke-order.mjs` adaptado al RPC.

## Orden y método
Por fase: plan corto → TDD con test RED real (skill `sdd-tdd`) → PR. F1 antes que F2 (el modelo de datos seguro es la base del flujo de eventos). Estimación: 3–4 semanas a ritmo de tardes, encaja en la «semana 6» de la auditoría si se adelanta.
