import { useState } from "react";
import { Badge } from "../ui/Badge";

export function OrderCard({ order, onRetryProcess }) {
  const isCompleted = order.status === "COMPLETED";
  const ref = order.id?.split("-")[0].toUpperCase();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetryProcess || retrying) return;
    setRetrying(true);
    try {
      await onRetryProcess(order.id);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="order-card">
      <div className="order-card__header">
        <strong className="order-card__name">
          {order.items?.length > 0
            ? `${order.items[0].name}${order.items.length > 1 ? ` y ${order.items.length - 1} más` : ""}`
            : "Pedido Web"}
        </strong>
        <Badge status={order.status} />
      </div>
      <div className="order-card__meta-group">
        <p className="order-card__ref">Ref: {ref}</p>
        <p className="order-card__ref order-card__total">
          {order.total ? `${order.total.toFixed(2)}€` : ""}
        </p>
      </div>

      <div className="order-card__actions-wrapper">
        <div className="order-card__action">
          {isCompleted && order.invoice_url ? (
            <a
              href={order.invoice_url}
              target="_blank"
              rel="noreferrer"
              className="order-card__invoice-link"
            >
              📄 Descargar Factura PDF
            </a>
          ) : (
            !isCompleted && (
              <button
                type="button"
                className="order-card__processing"
                onClick={handleRetry}
                disabled={retrying}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                {retrying ? "Generando factura..." : "Generando factura... (se actualiza solo)"}
              </button>
            )
          )}
        </div>
        <a
          href={`${(import.meta.env.VITE_FLEET_URL || "http://localhost:5174").replace(/\/$/, "")}/?tracking_id=${order.id}`}
          target="_blank"
          rel="noreferrer"
          className="order-card__track-link"
        >
          🚚 Rastrear Envío
        </a>
      </div>
    </div>
  );
}
