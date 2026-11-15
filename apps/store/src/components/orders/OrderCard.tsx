import { useState } from "react";
import { Badge } from "../ui/Badge";
import { FileIcon, TruckIcon } from "../ui/Icon";
import { orderRef } from "@nexus/domain";
import type { Order } from "../../types";

interface OrderCardProps {
  order: Order;
  onRetryProcess?: ((orderId: string) => unknown) | undefined;
  onOpenInvoice?: ((order: Order) => unknown) | undefined;
}

export function OrderCard({ order, onRetryProcess, onOpenInvoice }: OrderCardProps) {
  const isCompleted = order.status === "COMPLETED";
  const ref = orderRef(order.id);
  const [retrying, setRetrying] = useState(false);
  const firstItem = order.items[0];

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
          {firstItem
            ? `${firstItem.name}${order.items.length > 1 ? ` y ${order.items.length - 1} más` : ""}`
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
          {isCompleted && order.invoice_path ? (
            <button
              type="button"
              className="order-card__invoice-link"
              onClick={() => void onOpenInvoice?.(order)}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
            >
              <FileIcon className="icon--inline" /> Descargar Factura PDF
            </button>
          ) : (
            !isCompleted && (
              <button
                type="button"
                className="order-card__processing"
                onClick={handleRetry}
                disabled={retrying}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                {retrying
                  ? "Reenviando pedido..."
                  : order.status === "FAILED"
                    ? "No se pudo procesar. Pulsa para reintentar"
                    : "Generando factura... (se actualiza solo)"}
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
          <TruckIcon className="icon--inline" /> Rastrear Envío
        </a>
      </div>
    </div>
  );
}
