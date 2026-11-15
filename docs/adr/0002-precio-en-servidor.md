# 0002. El servidor decide el precio: RPC place_order en lugar de INSERT con RLS

Estado: aceptada

## Contexto

Antes el navegador calculaba total y precios y los insertaba en orders; cualquiera podía crear pedidos de 0,01 €. Una política RLS por sí sola no puede validar un total contra el catálogo de forma razonable.

## Decisión

Se revoca el INSERT directo sobre orders. La función SECURITY DEFINER place_order recibe solo ids y cantidades, valida (pedido no vacío, cantidades enteras de 1 a 100, producto existente), calcula el total con los precios del catálogo y guarda un snapshot de los ítems.

## Consecuencias

- El cliente ya no puede manipular precios; está cubierto por tests pgTAP (supabase/tests/database/f1_security.test.sql).
- Las reglas viven en SQL y se espejan en packages/domain (calculateOrderTotal, cart) con los mismos casos de prueba; hay una duplicación consciente que los tests mantienen sincronizada.
- Cambiar una regla exige una migración, no solo desplegar la web.

## Alternativas descartadas

Política RLS con WITH CHECK: no puede recalcular el total desde el catálogo. Edge Function de alta de pedidos: añade latencia y otro punto de despliegue sin ventaja frente a una RPC transaccional.
