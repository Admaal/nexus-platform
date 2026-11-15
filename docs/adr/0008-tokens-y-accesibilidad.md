# 0008. Tokens de diseño compartidos y accesibilidad verificada automáticamente

Estado: aceptada

## Contexto

Tienda y panel de flota tenían estilos independientes, colores de estado con contraste insuficiente y sin foco visible ni soporte de movimiento reducido.

## Decisión

packages/ui exporta tokens.css (colores de estado AA, espaciado, radios, movimiento) y base.css (foco visible, prefers-reduced-motion). Los drawers son diálogos modales con inert al cerrarse. Las pruebas E2E ejecutan axe (WCAG 2.1 A/AA) sobre las pantallas principales y el panel de pedidos.

## Consecuencias

- Los regresos de accesibilidad rompen el CI.
- Las pruebas miden con movimiento reducido para que las animaciones de aparición no falseen el contraste.
- axe cubre una parte de las reglas WCAG; no sustituye una revisión manual con lector de pantalla.

## Alternativas descartadas

Sistema de diseño completo con Storybook: excesivo para dos apps pequeñas.
