import { describe, expect, it } from 'vitest'
import { buildTimeline } from './timeline'

const states = (steps: ReturnType<typeof buildTimeline>) => steps.map((s) => s.state)

describe('buildTimeline', () => {
  it('lista los hitos en orden con el evento técnico de cada uno', () => {
    const steps = buildTimeline({ status: 'PENDING' }, [])
    expect(steps.map((s) => s.key)).toEqual(['received', 'invoice', 'email', 'shipment'])
    expect(steps.map((s) => s.event)).toEqual([
      'order.created',
      'invoice.generated',
      'email.sent',
      'shipment.started',
    ])
  })

  it('un pedido recién creado tiene recibido hecho y la factura en curso', () => {
    expect(states(buildTimeline({ status: 'PENDING' }, []))).toEqual(['done', 'current', 'pending', 'pending'])
  })

  it('avanza el paso en curso según los pasos completados', () => {
    expect(states(buildTimeline({ status: 'PROCESSING' }, ['invoice']))).toEqual(['done', 'done', 'current', 'pending'])
    expect(states(buildTimeline({ status: 'PROCESSING' }, ['invoice', 'email']))).toEqual([
      'done', 'done', 'done', 'current',
    ])
  })

  it('un pedido completado lo muestra todo hecho', () => {
    expect(states(buildTimeline({ status: 'COMPLETED' }, ['invoice', 'email', 'shipment']))).toEqual([
      'done', 'done', 'done', 'done',
    ])
  })

  it('COMPLETED implica todo hecho aunque aún no lleguen los pasos registrados', () => {
    expect(states(buildTimeline({ status: 'COMPLETED' }, []))).toEqual(['done', 'done', 'done', 'done'])
    expect(states(buildTimeline({ status: 'PROCESSING' }, []))).toEqual(['done', 'current', 'pending', 'pending'])
  })

  it('un pedido fallido marca como fallido el primer paso pendiente y deja el resto pendiente', () => {
    expect(states(buildTimeline({ status: 'FAILED' }, ['invoice']))).toEqual(['done', 'done', 'failed', 'pending'])
    expect(states(buildTimeline({ status: 'FAILED' }, []))).toEqual(['done', 'failed', 'pending', 'pending'])
  })

  it('el orden de llegada de los pasos no importa', () => {
    expect(states(buildTimeline({ status: 'PROCESSING' }, ['email', 'invoice']))).toEqual([
      'done', 'done', 'done', 'current',
    ])
  })

  it('un paso hecho tras uno pendiente no rompe la secuencia', () => {
    // email hecho pero invoice no: el primer pendiente sigue siendo invoice
    expect(states(buildTimeline({ status: 'PROCESSING' }, ['email']))).toEqual(['done', 'current', 'done', 'pending'])
  })
})
