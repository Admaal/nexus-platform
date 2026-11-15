import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CheckoutPage } from "./CheckoutPage";
import type { Cart } from "../hooks/useCart";
import type { CreateOrderResult, Orders } from "../hooks/useOrders";
import type { CartItem } from "../types";

const item: CartItem = { id: "k", name: "Teclado Mecánico Pro", price: 189.5, description: null, quantity: 2 };

function makeCart(items: CartItem[]): Cart {
  return {
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.price * i.quantity, 0),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
  };
}

function makeOrders(createOrder: Orders["createOrder"]): Orders {
  return {
    orders: [],
    loading: false,
    fetchOrders: vi.fn(() => Promise.resolve()),
    createOrder,
    retryProcessOrder: vi.fn(() => Promise.resolve({ data: { requested: true }, error: null })),
    openInvoice: vi.fn(() => Promise.resolve()),
  };
}

function renderCheckout(cart: Cart, orders: Orders) {
  return render(
    <MemoryRouter initialEntries={["/checkout"]}>
      <Routes>
        <Route path="/" element={<p>Página de la tienda</p>} />
        <Route path="/checkout" element={<CheckoutPage cart={cart} orders={orders} />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillForm() {
  await userEvent.type(screen.getByLabelText("Nombre completo"), "Ada Lovelace");
  await userEvent.type(screen.getByLabelText("Correo electrónico"), "ada@mail.com");
  await userEvent.type(screen.getByLabelText("Dirección de envío"), "Calle Mayor 1, Madrid");
}

describe("CheckoutPage", () => {
  it("con el carrito vacío ofrece volver a la tienda", async () => {
    renderCheckout(makeCart([]), makeOrders(vi.fn()));

    expect(screen.getByRole("heading", { name: "Tu carrito está vacío" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volver a la tienda" }));
    expect(await screen.findByText("Página de la tienda")).toBeInTheDocument();
  });

  it("muestra el resumen con el total del carrito", () => {
    renderCheckout(makeCart([item]), makeOrders(vi.fn()));

    const summary = screen.getByRole("heading", { name: "Resumen del pedido" }).closest("aside");
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText("Teclado Mecánico Pro")).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText("379.00€", { selector: ".checkout-summary__total-amount" })).toBeInTheDocument();
  });

  it("valida el formulario y no crea el pedido si hay errores", async () => {
    const createOrder = vi.fn();
    renderCheckout(makeCart([item]), makeOrders(createOrder));

    await userEvent.type(screen.getByLabelText("Correo electrónico"), "no-es-un-email");
    await userEvent.click(screen.getByRole("button", { name: /Confirmar Pedido/ }));

    expect(await screen.findByText("El nombre debe tener al menos 2 caracteres")).toBeInTheDocument();
    expect(screen.getByText("Correo electrónico inválido")).toBeInTheDocument();
    expect(screen.getByText("La dirección es obligatoria y debe ser real")).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("crea el pedido con los datos del formulario, vacía el carrito y vuelve a la tienda", async () => {
    const createOrder = vi.fn<Orders["createOrder"]>(() => Promise.resolve({ error: null }));
    const cart = makeCart([item]);
    renderCheckout(cart, makeOrders(createOrder));

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /Confirmar Pedido/ }));

    expect(await screen.findByText("Página de la tienda")).toBeInTheDocument();
    expect(createOrder).toHaveBeenCalledWith(cart.items, {
      name: "Ada Lovelace",
      email: "ada@mail.com",
      address: "Calle Mayor 1, Madrid",
    });
    expect(cart.clearCart).toHaveBeenCalledOnce();
  });

  it("si el servidor rechaza el pedido muestra el error y conserva el carrito", async () => {
    const createOrder = vi.fn<Orders["createOrder"]>(() =>
      Promise.resolve<CreateOrderResult>({ error: { message: "UNKNOWN_PRODUCT" } }),
    );
    const cart = makeCart([item]);
    renderCheckout(cart, makeOrders(createOrder));

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /Confirmar Pedido/ }));

    expect(await screen.findByText("UNKNOWN_PRODUCT")).toBeInTheDocument();
    expect(cart.clearCart).not.toHaveBeenCalled();
    expect(screen.queryByText("Página de la tienda")).not.toBeInTheDocument();
  });
});
