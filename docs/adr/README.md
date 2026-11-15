# Decisiones de arquitectura

| ADR | Decisión |
| --- | --- |
| [0001](0001-cola-pgmq.md) | Cola de mensajes con pgmq (Supabase Queues) en lugar de Pub/Sub |
| [0002](0002-precio-en-servidor.md) | El servidor decide el precio: RPC place_order en lugar de INSERT con RLS |
| [0003](0003-evento-transaccional-idempotencia.md) | Evento encolado en la misma transacción y entrega al menos una vez con pasos idempotentes |
| [0004](0004-reintentos-y-dlq.md) | Reintentos con backoff, DLQ y clasificación de errores en el dominio |
| [0005](0005-dominio-puro.md) | Dominio puro compartido con mutation testing |
| [0006](0006-facturas-privadas.md) | Facturas en un bucket privado con URLs firmadas |
| [0007](0007-telemetria-publica.md) | Telemetría pública por diseño, defendida con validación, camiones conocidos y límite de ritmo |
| [0008](0008-tokens-y-accesibilidad.md) | Tokens de diseño compartidos y accesibilidad verificada automáticamente |
