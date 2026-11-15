# 0007. Telemetría pública por diseño, defendida con validación, camiones conocidos y límite de ritmo

Estado: aceptada

## Contexto

El simulador de GPS corre en el navegador, así que cualquier secreto para llamar a la ingesta acabaría en el bundle. El secreto anterior no protegía nada.

## Decisión

telemetry-ingest no usa secreto. Valida el cuerpo con Zod (rangos de latitud y longitud), solo acepta camiones conocidos (un pedido existente o el DEMO_TRUCK_ID configurado) y limita a 60 pings por minuto y camión con una ventana fija en base de datos (telemetry_rate_ok).

## Consecuencias

- Se elimina un falso sentido de seguridad y un secreto en el frontend.
- Quien conozca el id de un pedido puede escribir telemetría de ese pedido, dentro del límite. Es aceptable en una demo; un sistema real autenticaría al dispositivo.
- La lectura de telemetría sigue siendo pública para que Realtime funcione con un filtro por truck_id.

## Alternativas descartadas

Mover el simulador al servidor: requiere un proceso de larga duración que Edge Functions no ofrece. Autenticar con la sesión anónima: no cubre el seguimiento abierto desde el email en otro navegador.
