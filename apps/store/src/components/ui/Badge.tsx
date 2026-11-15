import type { OrderStatus } from "../../types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "badge--pending",
  PROCESSING: "badge--processing",
  COMPLETED: "badge--completed",
  FAILED: "badge--failed",
};

export function Badge({ status }: { status: OrderStatus }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? "badge--pending"}`}>
      {status}
    </span>
  );
}
