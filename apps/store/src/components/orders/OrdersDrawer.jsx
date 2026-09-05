import { OrderCard } from "./OrderCard";
import { PackageIcon } from "../ui/Icon";

export function OrdersDrawer({ isOpen, onClose, orders, onRetryProcess, checkoutWarning }) {
  return (
    <>
      {isOpen && <div className="overlay" onClick={onClose} />}
      <aside className={`drawer drawer--right ${isOpen ? "drawer--open" : ""}`}>
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
                <OrderCard key={order.id} order={order} onRetryProcess={onRetryProcess} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
