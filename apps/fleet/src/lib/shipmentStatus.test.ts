import { describe, expect, it } from "vitest";
import { shipmentLabel } from "./shipmentStatus";

describe("shipmentLabel", () => {
  it.each([
    ["PENDING", "Preparando el envío"],
    ["IN_TRANSIT", "En camino"],
    ["DELIVERED", "Entregado"],
    ["FAILED", "Incidencia con el envío"],
  ])("%s → %s", (status, label) => {
    expect(shipmentLabel(status)).toBe(label);
  });

  it("indica que está consultando mientras no hay dato", () => {
    expect(shipmentLabel(null)).toBe("Consultando el estado…");
  });

  it("no inventa texto para estados desconocidos", () => {
    expect(shipmentLabel("OTRO")).toBe("Estado desconocido");
  });
});
