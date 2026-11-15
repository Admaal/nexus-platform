# Nexus Platform

Tienda e-commerce y panel de flota en tiempo real enlazados por el ID del pedido, sobre Supabase. Proyecto de portfolio que evoluciona a un flujo **event-driven** (cola, idempotencia, reintentos, DLQ).

Este archivo es la fuente de verdad de la fase y de la valla. El historial vive en `docs/fases.md`. El plan de trabajo está en `docs/roadmap.md`.

## Fase actual

**Fase 0 — base y valla.** TypeScript estricto, CI y dominio puro con mutation testing.

No construyas la fase siguiente (F1: seguridad y dominio en servidor) hasta cerrar esta. Si dudas del alcance, pregunta.

## Stack

- Lenguaje: TypeScript estricto (`tsconfig.base.json`). Apps en migración desde JS (`allowJs` solo mientras dure).
- Frontend: React 19 + Vite (`apps/store`, `apps/fleet`). Backend: Supabase (Postgres, Edge Functions en Deno, Realtime).
- Tests: Vitest (`npm test`). Mutation: Stryker.
- Dominio: `packages/domain/src/` (puro, sin framework ni E/S).
- Lint de pureza: `no-restricted-imports` y `no-restricted-globals` en `packages/domain/eslint.config.js`.

## Principios no negociables

- El dominio no importa React, Supabase, pdf-lib, Node ni E/S. Comprobación: `npm run lint -w @nexus/domain`.
- El precio de un pedido lo decide el servidor con el catálogo, nunca el cliente. Comprobación: tests de `calculateOrderTotal` y mutation del dominio.
- Sin `any` implícito ni índices sin comprobar. Comprobación: `npm run typecheck` (`strict`, `noUncheckedIndexedAccess`).

## Valla

1. **Pureza de dominio:** falla en el lint, no en la review.
2. **TDD:** un test en rojo antes de implementar. `gates.ps1 fast` anota `RED` en `.cursor/red.log`.
3. **Mutation testing** solo del dominio, umbral 75 % (`break`). `full` corre la incremental si el diff toca `packages/domain/src/`; `ci` corre la completa.
4. **Hooks** (`.cursor/hooks.json`, PowerShell): `postToolUse` → `gates.ps1 fast`; `stop` → `gates.ps1 full`; `beforeShellExecution` → `guard-shell.ps1`.
   - Medición `full` en caliente: ~20 s (2026-11-15, domain + 2 apps, sin mutación pesada). El presupuesto del bucle rápido se fija tras medir `fast` varias veces; pendiente.
5. **CI** (`.github/workflows/ci.yml`): llama a `scripts/gates.ps1 ci`, con job agregador `Gate obligatorio`.
6. **Rama `main`:** los cambios llegan por PR con CI en verde (`gh pr checks`). Protección de rama pendiente de decidir según visibilidad del repo.

## Cómo trabajo con IA

Uso agentes de IA con guardarraíles mecánicos, no confianza: TDD con test rojo real, mutation testing del dominio, gates en hooks y CI. Los hooks viven en `.cursor/`; el kit está versionado para que cualquiera pueda reproducir el flujo.

## Comandos

- Rápido: `powershell -NoProfile -File scripts/gates.ps1 fast <ruta>`
- Completo local: `powershell -NoProfile -File scripts/gates.ps1 full`
- CI: `powershell -NoProfile -File scripts/gates.ps1 ci`
- Config del proyecto: `scripts/gates.config.ps1`
- Recuperar un checkpoint de `guard-shell`: `git restore --source=<ref de refs/valla/checkpoints> -- .`
