import { ORDER_STEPS, type OrderStep } from './events'

export type StepState = 'done' | 'current' | 'pending' | 'failed'

export interface TimelineStep {
  readonly key: 'received' | OrderStep
  /** Nombre del evento técnico asociado, para mostrar cómo funciona el sistema. */
  readonly event: string
  readonly state: StepState
}

const STEP_EVENTS: Readonly<Record<OrderStep, string>> = {
  invoice: 'invoice.generated',
  email: 'email.sent',
  shipment: 'shipment.started',
}

/** Línea temporal de un pedido a partir de su estado y de los pasos ya registrados. */
export function buildTimeline(order: { readonly status: string }, doneSteps: readonly OrderStep[]): TimelineStep[] {
  const completed = order.status === 'COMPLETED'
  let blocking: OrderStep | undefined

  const steps: TimelineStep[] = ORDER_STEPS.map((step) => {
    if (completed || doneSteps.includes(step)) {
      return { key: step, event: STEP_EVENTS[step], state: 'done' }
    }
    if (blocking === undefined) {
      blocking = step
      return { key: step, event: STEP_EVENTS[step], state: order.status === 'FAILED' ? 'failed' : 'current' }
    }
    return { key: step, event: STEP_EVENTS[step], state: 'pending' }
  })

  return [{ key: 'received', event: 'order.created', state: 'done' }, ...steps]
}
