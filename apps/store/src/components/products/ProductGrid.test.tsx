import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductGrid } from "./ProductGrid";
import type { Product } from "../../types";

const product: Product = { id: "k", name: "Teclado Mecánico Pro", price: 189.5, description: "Silencioso" };

describe("ProductGrid", () => {
  it("muestra esqueletos mientras carga", () => {
    const { container } = render(<ProductGrid products={[]} loading onAddToCart={vi.fn()} />);
    expect(container.querySelectorAll(".skeleton-card")).toHaveLength(6);
  });

  it("si falla la carga avisa con una alerta y permite reintentar", async () => {
    const onRetry = vi.fn();
    render(<ProductGrid products={[]} loading={false} error="network" onRetry={onRetry} onAddToCart={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar el catálogo");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("sin productos muestra el estado vacío", () => {
    render(<ProductGrid products={[]} loading={false} onAddToCart={vi.fn()} />);
    expect(screen.getByText(/No hay productos disponibles/)).toBeInTheDocument();
  });

  it("añade al carrito el producto pulsado", async () => {
    const onAddToCart = vi.fn();
    render(<ProductGrid products={[product]} loading={false} onAddToCart={onAddToCart} />);

    await userEvent.click(screen.getByRole("button", { name: "Añadir" }));
    expect(onAddToCart).toHaveBeenCalledWith(product);
  });
});
