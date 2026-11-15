# 0001. Cola de mensajes con pgmq (Supabase Queues) en lugar de Pub/Sub

Estado: aceptada

## Contexto

El flujo de un pedido (factura, email, envío) debe ser asíncrono, tolerar fallos y reintentarse. El proyecto ya usa Supabase y es una demo de coste cero; un broker externo (Pub/Sub, SQS) añadiría una cuenta de nube, credenciales y un segundo sistema que operar.

## Decisión

Se usa pgmq, la cola sobre Postgres que incluye Supabase. Hay dos colas: order_events y order_events_dlq. El worker es una Edge Function que lee por lotes con un visibility timeout de 60 s.

## Consecuencias

- Encolar es transaccional con el pedido (ver ADR 0003): no hay "dual write" entre base de datos y broker.
- Sin infraestructura nueva ni coste; el modelo (visibility timeout, archivado, DLQ) es el mismo que en Pub/Sub o SQS.
- No escala como un broker dedicado ni ofrece push nativo: se despierta al worker con pg_net y un barrido de pg_cron cada minuto.
- Migrar a Pub/Sub afecta solo a las funciones worker_* de la migración y al bucle del worker; el dominio no cambia.

## Alternativas descartadas

Google Pub/Sub: más realista a escala, pero exige proyecto GCP, IAM y un endpoint push autenticado. Se descarta para la demo; la migración es directa. Supabase Realtime como cola: no garantiza entrega ni reintentos.
