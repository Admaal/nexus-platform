# 0006. Facturas en un bucket privado con URLs firmadas

Estado: aceptada

## Contexto

Las facturas contienen nombre, email y dirección. Con un bucket público bastaba conocer el UUID del pedido para descargarlas.

## Decisión

El bucket invoices es privado y los ficheros se guardan como {user_id}/{order_id}.pdf. Una política de storage solo permite leer los del propio usuario. La tienda pide una URL firmada de 10 minutos al abrir la factura; el email incluye una de 7 días.

## Consecuencias

- Sin firma, la URL devuelve error (lo comprueba el E2E).
- El enlace del email caduca; el usuario puede pedir uno nuevo desde su panel de pedidos.

## Alternativas descartadas

Bucket público con nombres impredecibles: seguridad por oscuridad. Servir el PDF desde una función: más código y sin ventaja.
