import type { OrderStep } from "@nexus/domain";
import { OrderCard } from "./OrderCard";
import { useEscapeToClose } from "../../hooks/useDrawer";
import { PackageIcon } from "../ui/Icon";
import type { Order } from "../../types";

interface OrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onRetryProcess?: (orderId: string) => unknown;
  onOpenInvoice?: (order: Order) => unknown;
  checkoutWarning?: string | undefined;
  stepsByOrder?: Record<string, OrderStep[]>;
}

export function OrdersDrawer({ isOpen, onClose, orders, onRetryProcess, onOpenInvoice, checkoutWarning, stepsByOrder = {} }: OrdersDrawerProps) {
  useEscapeToClose(isOpen, onClose);

  return (
    <>
      {isOpen && <div className="overlay" onClick={onClose} />}
      <aside
        className={`drawer drawer--right ${isOpen ? "drawer--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mis pedidos"
        inert={!isOpen}
      >
        <div className="drawer__header">
          <h2 className="drawer__title">Mis Pedidos</h2>
          <button className="drawer__close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="drawer__body">
          {checkoutWarning && (
            <p className="form-error form-error--global" style={{ marginBottom: "12px" }}>
              {checkoutWarning}
            </p>
          )}
          {orders.length === 0 ? (
            <div className="drawer__empty">
              <PackageIcon className="drawer__empty-icon" />
              <p>No tienes pedidos todavía</p>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} onRetryProcess={onRetryProcess} onOpenInvoice={onOpenInvoice} steps={stepsByOrder[order.id] ?? []} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
