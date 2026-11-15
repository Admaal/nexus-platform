# 0004. Reintentos con backoff, DLQ y clasificación de errores en el dominio

Estado: aceptada

## Contexto

No todo fallo merece reintento: un 503 del proveedor de correo sí, un 401 por credenciales inválidas no. Reintentar errores permanentes desperdicia intentos y oculta el problema.

## Decisión

packages/domain/src/events.ts, puro y sin dependencias, decide: classifyHttpStatus (5xx, 408, 425 y 429 son transitorios; el resto de 4xx, permanentes), retryDelaySeconds (backoff exponencial 5 s × 2^(n-1), tope 300 s) y decideOnFailure (permanente o intentos agotados → DLQ; si no, reintento). El worker lo importa por ruta relativa. Tras la DLQ, el pedido queda FAILED con el motivo y el propietario puede reprocesarlo.

## Consecuencias

- La política de reintentos se prueba con tests unitarios y mutation testing (100 %), sin levantar infraestructura.
- El motivo del fallo es visible en el panel de pedidos del usuario.
- No hay jitter en el backoff; con un solo worker no hace falta, pero habría que añadirlo si se escalara.

## Alternativas descartadas

Dejar la política en el worker: mezcla decisión y E/S y obliga a probarla con red.
