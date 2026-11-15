# 0003. Evento encolado en la misma transacción y entrega al menos una vez con pasos idempotentes

Estado: aceptada

## Contexto

Si el pedido se guarda y luego se publica un evento en otro sistema, un fallo entre ambos pasos pierde el evento o lo publica sin pedido. Además, los brokers entregan al menos una vez, así que un paso puede ejecutarse dos veces.

## Decisión

place_order inserta el pedido y llama a pgmq.send dentro de la misma transacción (la cola vive en la misma base de datos). El worker registra cada paso completado en order_event_steps con clave primaria (order_id, step) y salta los ya hechos al reentregar.

## Consecuencias

- O existen pedido y evento, o ninguno de los dos.
- Reprocesar un pedido (redrive) no repite pasos ya hechos; lo comprueba scripts/e2e-events.mjs.
- Queda una ventana pequeña: si el worker cae tras enviar el email y antes de registrar el paso, el email puede repetirse. Es el coste de "al menos una vez" sin idempotencia en el proveedor de correo.

## Alternativas descartadas

Patrón outbox con tabla y poller: innecesario porque la cola ya es transaccional. "Exactamente una vez": no es alcanzable de extremo a extremo con un proveedor de correo externo.
