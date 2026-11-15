# 0005. Dominio puro compartido con mutation testing

Estado: aceptada

## Contexto

La lógica de negocio (totales, carrito, reintentos, línea temporal) se necesita en la web, en el worker (Deno) y en las pruebas. Tenerla mezclada con React o con Supabase la hace difícil de probar y de reutilizar.

## Decisión

packages/domain contiene TypeScript puro, sin framework ni E/S. Una regla de ESLint (no-restricted-imports y no-restricted-globals) lo garantiza. Se prueba con Vitest y Stryker con umbral de rotura del 75 %, hoy al 100 %.

## Consecuencias

- Mismo código en navegador y Edge Functions, sin duplicar reglas de reintento o de carrito.
- La mutation testing detecta tests que no protegen nada: ya cazó dos casos límite sin cubrir.
- Las funciones Edge importan el dominio por ruta relativa; es una restricción del despliegue con la CLI de Supabase y está verificada con functions serve.

## Alternativas descartadas

Duplicar la lógica en cada app: deriva garantizada. Paquete publicado en npm: sobredimensionado para un monorepo.
