import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OrderCard } from "./OrderCard";
import type { Order } from "../../types";

const baseOrder: Order = {
  id: "3f2a9c1e-1111-2222-3333-444455556666",
  customer_email: "ada@mail.com",
  customer_name: "Ada",
  shipping_address: "Calle Mayor 1",
  invoice_path: null,
  failure_reason: null,
  status: "PENDING",
  created_at: "2026-01-01T00:00:00Z",
  total: 284.5,
  items: [
    { product_id: "k", name: "Teclado", price: 189.5, quantity: 1 },
    { product_id: "m", name: "Ratón", price: 95, quantity: 1 },
  ],
  user_id: "u1",
};

describe("OrderCard", () => {
  it("resume el pedido: primer producto, resto, referencia y total", () => {
    render(<OrderCard order={baseOrder} />);

    expect(screen.getByText("Teclado y 1 más")).toBeInTheDocument();
    expect(screen.getByText("Ref: 3F2A9C1E")).toBeInTheDocument();
    expect(screen.getByText("284.50€")).toBeInTheDocument();
  });

  it("enlaza el seguimiento al panel de flota con el id del pedido", () => {
    render(<OrderCard order={baseOrder} />);

    const link = screen.getByRole("link", { name: /Rastrear Envío/ });
    expect(link).toHaveAttribute("href", expect.stringContaining(`/?tracking_id=${baseOrder.id}`));
  });

  it("un pedido completado ofrece la factura y la abre al pulsar", async () => {
    const onOpenInvoice = vi.fn();
    const order: Order = { ...baseOrder, status: "COMPLETED", invoice_path: "u1/o.pdf" };
    render(<OrderCard order={order} onOpenInvoice={onOpenInvoice} />);

    await userEvent.click(screen.getByRole("button", { name: /Descargar Factura PDF/ }));

    expect(onOpenInvoice).toHaveBeenCalledWith(order);
  });

  it("un pedido pendiente no ofrece factura y avisa de que se está generando", () => {
    render(<OrderCard order={baseOrder} />);

    expect(screen.queryByText(/Descargar Factura/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generando factura/ })).toBeInTheDocument();
  });

  it("un pedido fallido permite reintentar y bloquea el botón mientras reintenta", async () => {
    let finish: () => void = () => undefined;
    const onRetryProcess = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<OrderCard order={{ ...baseOrder, status: "FAILED" }} onRetryProcess={onRetryProcess} />);

    const button = screen.getByRole("button", { name: /No se pudo procesar/ });
    await userEvent.click(button);

    expect(onRetryProcess).toHaveBeenCalledWith(baseOrder.id);
    expect(screen.getByRole("button", { name: /Reenviando pedido/ })).toBeDisabled();

    finish();
    expect(await screen.findByRole("button", { name: /No se pudo procesar/ })).toBeEnabled();
  });
});
