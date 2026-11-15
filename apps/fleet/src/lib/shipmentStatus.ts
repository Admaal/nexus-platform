export type ShipmentStatus = "PENDING" | "IN_TRANSIT" | "DELIVERED" | "FAILED";

const LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Preparando el envío",
  IN_TRANSIT: "En camino",
  DELIVERED: "Entregado",
  FAILED: "Incidencia con el envío",
};

/** Texto para el cliente a partir del estado de envío guardado en base de datos. */
export function shipmentLabel(status: string | null): string {
  if (status === null) return "Consultando el estado…";
  return LABELS[status as ShipmentStatus] ?? "Estado desconocido";
}
