# Fases

Historial. La fase vigente está en `AGENTS.md`, no aquí.

| Fase | Resultado |
| --- | --- |
| 0 · Base y valla | TypeScript estricto en apps y funciones, CI con job agregador, dominio puro con mutation testing |
| 1 · Seguridad en servidor | `place_order`, RLS cerrada, bucket de facturas privado, sin secretos de `process-order` en el frontend |
| 2 · Flujo por eventos | pgmq, `order-worker` idempotente con reintentos y DLQ, `telemetry-ingest` validada y con límite de ritmo |
| 3 · Tests reales | Carrito en el dominio, tests de comportamiento, integración del worker y E2E Playwright en CI |
| 4 · Diseño y producto | Línea temporal en vivo, tokens compartidos, accesibilidad AA con axe |
| 5 · Documentación | README con diagramas, ocho ADRs y guía de despliegue |
