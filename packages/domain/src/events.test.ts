import { describe, expect, it } from 'vitest'
import {
  classifyHttpStatus,
  decideOnFailure,
  ORDER_STEPS,
  pendingSteps,
  retryDelaySeconds,
} from './events'

describe('classifyHttpStatus', () => {
  it.each([408, 425, 429, 500, 502, 503, 504, 599])('%s es transitorio', (status) => {
    expect(classifyHttpStatus(status)).toBe('transient')
  })

  it.each([400, 401, 403, 404, 409, 422])('%s es permanente', (status) => {
    expect(classifyHttpStatus(status)).toBe('permanent')
  })
})

describe('retryDelaySeconds', () => {
  it('crece de forma exponencial desde la base', () => {
    expect([1, 2, 3, 4].map((n) => retryDelaySeconds(n))).toEqual([5, 10, 20, 40])
  })

  it('respeta el tope', () => {
    expect(retryDelaySeconds(20)).toBe(300)
    expect(retryDelaySeconds(6, 5, 100)).toBe(100)
  })

  it('trata intentos menores que 1 como el primero', () => {
    expect(retryDelaySeconds(0)).toBe(5)
    expect(retryDelaySeconds(-3)).toBe(5)
  })
})

describe('decideOnFailure', () => {
  it('un error permanente va directo a la DLQ aunque queden intentos', () => {
    expect(decideOnFailure({ readCount: 1, maxAttempts: 5, errorClass: 'permanent' })).toEqual({
      action: 'dead-letter',
      reason: 'PERMANENT_ERROR',
    })
  })

  it('un error transitorio reintenta con backoff mientras queden intentos', () => {
    expect(decideOnFailure({ readCount: 1, maxAttempts: 5, errorClass: 'transient' })).toEqual({
      action: 'retry',
      delaySeconds: 5,
    })
    expect(decideOnFailure({ readCount: 4, maxAttempts: 5, errorClass: 'transient' })).toEqual({
      action: 'retry',
      delaySeconds: 40,
    })
  })

  it('al agotar los intentos va a la DLQ', () => {
    expect(decideOnFailure({ readCount: 5, maxAttempts: 5, errorClass: 'transient' })).toEqual({
      action: 'dead-letter',
      reason: 'MAX_ATTEMPTS_EXCEEDED',
    })
    expect(decideOnFailure({ readCount: 9, maxAttempts: 5, errorClass: 'transient' })).toEqual({
      action: 'dead-letter',
      reason: 'MAX_ATTEMPTS_EXCEEDED',
    })
  })
})

describe('pendingSteps', () => {
  it('devuelve el pipeline completo en orden si no hay nada hecho', () => {
    expect(pendingSteps([])).toEqual(['invoice', 'email', 'shipment'])
    expect(ORDER_STEPS).toEqual(['invoice', 'email', 'shipment'])
  })

  it('omite los pasos ya completados conservando el orden', () => {
    expect(pendingSteps(['invoice'])).toEqual(['email', 'shipment'])
    expect(pendingSteps(['shipment', 'invoice'])).toEqual(['email'])
  })

  it('no devuelve nada cuando todo está hecho', () => {
    expect(pendingSteps(['invoice', 'email', 'shipment'])).toEqual([])
  })
})
