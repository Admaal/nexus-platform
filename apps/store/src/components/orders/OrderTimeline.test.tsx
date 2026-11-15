import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderTimeline } from "./OrderTimeline";

describe("OrderTimeline", () => {
  it("muestra los hitos con su evento técnico y el estado como texto accesible", () => {
    render(<OrderTimeline order={{ status: "PROCESSING", failure_reason: null }} steps={["invoice"]} />);

    const list = screen.getByRole("list", { name: "Progreso del pedido" });
    const items = within(list).getAllByRole("listitem");

    expect(items.map((li) => li.textContent)).toEqual([
      "Pedido recibido — completadoorder.created",
      "Factura generada — completadoinvoice.generated",
      "Email enviado — en cursoemail.sent",
      "Envío en marcha — pendienteshipment.started",
    ]);
  });

  it("anuncia los cambios de progreso a lectores de pantalla", () => {
    render(<OrderTimeline order={{ status: "PENDING", failure_reason: null }} steps={[]} />);
    expect(screen.getByRole("list", { name: "Progreso del pedido" })).toHaveAttribute("aria-live", "polite");
  });

  it("un pedido fallido muestra el motivo como alerta y marca el paso con error", () => {
    render(
      <OrderTimeline
        order={{ status: "FAILED", failure_reason: "PERMANENT_ERROR: Brevo 401" }}
        steps={["invoice"]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo completar el pedido: PERMANENT_ERROR: Brevo 401");
    expect(screen.getByText(/Email enviado/).textContent).toContain("con error");
  });

  it("un pedido correcto no muestra alerta", () => {
    render(<OrderTimeline order={{ status: "COMPLETED", failure_reason: null }} steps={["invoice", "email", "shipment"]} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
