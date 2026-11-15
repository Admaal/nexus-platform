import { buildTimeline, type OrderStep, type StepState, type TimelineStep } from "@nexus/domain";
import type { Order } from "../../types";

const LABELS: Record<TimelineStep["key"], string> = {
  received: "Pedido recibido",
  invoice: "Factura generada",
  email: "Email enviado",
  shipment: "Envío en marcha",
};

const STATE_TEXT: Record<StepState, string> = {
  done: "completado",
  current: "en curso",
  pending: "pendiente",
  failed: "con error",
};

interface OrderTimelineProps {
  order: Pick<Order, "status" | "failure_reason">;
  steps: readonly OrderStep[];
}

/** Línea temporal en vivo del pedido: cada hito corresponde a un evento del backend. */
export function OrderTimeline({ order, steps }: OrderTimelineProps) {
  const timeline = buildTimeline(order, steps);

  return (
    <div className="timeline">
      <ol className="timeline__list" aria-label="Progreso del pedido" aria-live="polite">
        {timeline.map((step) => (
          <li key={step.key} className={`timeline__item timeline__item--${step.state}`}>
            <span className="timeline__marker" aria-hidden="true" />
            <span className="timeline__label">
              {LABELS[step.key]}
              <span className="nx-sr-only"> — {STATE_TEXT[step.state]}</span>
            </span>
            <code className="timeline__event">{step.event}</code>
          </li>
        ))}
      </ol>
      {order.status === "FAILED" && (
        <p className="timeline__failure" role="alert">
          No se pudo completar el pedido{order.failure_reason ? `: ${order.failure_reason}` : "."}
        </p>
      )}
    </div>
  );
}
