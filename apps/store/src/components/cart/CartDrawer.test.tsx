import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CartDrawer } from "./CartDrawer";

function renderDrawer(isOpen: boolean, onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <CartDrawer isOpen={isOpen} onClose={onClose} items={[]} total={0} onRemove={vi.fn()} onUpdateQuantity={vi.fn()} />
    </MemoryRouter>,
  );
  return onClose;
}

describe("CartDrawer (accesibilidad)", () => {
  it("es un diálogo modal con nombre", () => {
    renderDrawer(true);
    const dialog = screen.getByRole("dialog", { name: "Tu carrito" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("cerrado queda inerte (atributo inert: sin foco ni lectura)", () => {
    renderDrawer(false);
    expect(document.querySelector("aside.drawer")).toHaveAttribute("inert");
  });

  it("se cierra con Escape solo cuando está abierto", async () => {
    const onClose = renderDrawer(true);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("cerrado ignora Escape", async () => {
    const onClose = renderDrawer(false);
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});
