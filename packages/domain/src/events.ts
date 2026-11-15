// Lógica pura del flujo por eventos: clasificación de errores, reintentos y pipeline.
// Sin imports: el worker (Deno) lo importa por ruta relativa.

export type ErrorClass = 'transient' | 'permanent'

export const ORDER_STEPS = ['invoice', 'email', 'shipment'] as const
export type OrderStep = (typeof ORDER_STEPS)[number]

export interface FailureContext {
  /** Veces que se ha entregado el mensaje (pgmq read_ct; 1 en la primera entrega). */
  readonly readCount: number
  readonly maxAttempts: number
  readonly errorClass: ErrorClass
}

export type FailureDecision =
  | { readonly action: 'retry'; readonly delaySeconds: number }
  | { readonly action: 'dead-letter'; readonly reason: 'PERMANENT_ERROR' | 'MAX_ATTEMPTS_EXCEEDED' }

const TRANSIENT_STATUSES: readonly number[] = [408, 425, 429]

/** 5xx y algunos 4xx (timeout, demasiado pronto, rate limit) merecen reintento; el resto no. */
export function classifyHttpStatus(status: number): ErrorClass {
  return status >= 500 || TRANSIENT_STATUSES.includes(status) ? 'transient' : 'permanent'
}

/** Backoff exponencial: base * 2^(intento-1), con tope. */
export function retryDelaySeconds(attempt: number, baseSeconds = 5, capSeconds = 300): number {
  const n = Math.max(1, Math.floor(attempt))
  return Math.min(baseSeconds * 2 ** (n - 1), capSeconds)
}

export function decideOnFailure({ readCount, maxAttempts, errorClass }: FailureContext): FailureDecision {
  if (errorClass === 'permanent') return { action: 'dead-letter', reason: 'PERMANENT_ERROR' }
  if (readCount >= maxAttempts) return { action: 'dead-letter', reason: 'MAX_ATTEMPTS_EXCEEDED' }
  return { action: 'retry', delaySeconds: retryDelaySeconds(readCount) }
}

/** Pasos del pedido aún por ejecutar, en orden del pipeline. */
export function pendingSteps(done: readonly OrderStep[]): OrderStep[] {
  return ORDER_STEPS.filter((step) => !done.includes(step))
}
