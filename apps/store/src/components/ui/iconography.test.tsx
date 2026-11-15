import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CartDrawer } from "../cart/CartDrawer";
import { Footer } from "../layout/Footer";
import { OrderCard } from "../orders/OrderCard";
import { OrdersDrawer } from "../orders/OrdersDrawer";
import { ReviewsSection } from "../sections/ReviewsSection";
import { CheckoutPage } from "../../pages/CheckoutPage";
import type { Cart } from "../../hooks/useCart";
import type { Orders } from "../../hooks/useOrders";
import type { Order } from "../../types";

const forbiddenIconCharacters =
  /[\u{1F000}-\u{1FAFF}\u{2100}-\u{214F}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}]/u;

const emptyCart: Cart = {
  items: [],
  itemCount: 0,
  total: 0,
  addItem: () => undefined,
  removeItem: () => undefined,
  updateQuantity: () => undefined,
  clearCart: () => undefined,
};

const emptyOrders: Orders = {
  orders: [],
  loading: false,
  fetchOrders: () => Promise.resolve(),
  createOrder: () => Promise.resolve({ error: null }),
  retryProcessOrder: () => Promise.resolve({ data: null, error: null }),
};

const completedOrder: Order = {
  id: "12345678-1234-1234-1234-123456789012",
  customer_email: "ada@mail.com",
  customer_name: "Ada",
  shipping_address: "Calle Mayor 1",
  status: "COMPLETED",
  invoice_url: "/invoice.pdf",
  created_at: "2026-01-01T00:00:00Z",
  total: 19.99,
  items: [],
  user_id: null,
};

describe("iconografía de la tienda / AC-01 a AC-09", () => {
  it("renderiza estados y acciones sin pictogramas Unicode", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <CartDrawer
          isOpen
          onClose={() => undefined}
          items={emptyCart.items}
          total={emptyCart.total}
          onRemove={emptyCart.removeItem}
          onUpdateQuantity={emptyCart.updateQuantity}
        />
        <OrdersDrawer
          isOpen
          onClose={() => undefined}
          orders={emptyOrders.orders}
        />
        <CheckoutPage cart={emptyCart} orders={emptyOrders} />
        <Footer />
        <OrderCard
          order={completedOrder}
          onRetryProcess={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(markup).not.toMatch(forbiddenIconCharacters);
    expect(markup).not.toContain(String.fromCodePoint(0x2192));
    expect(markup).not.toContain(String.fromCodePoint(0x2605));
    expect(markup).toContain("Descargar Factura PDF");
    expect(markup).toContain("Rastrear Envío");
    expect(markup).toContain('aria-hidden="true"');
  });

  it("genera cinco estrellas SVG por cada reseña", () => {
    const markup = renderToStaticMarkup(<ReviewsSection />);

    expect(markup.match(/<svg/g)).toHaveLength(15);
    expect(markup).toContain('aria-label="5 de 5 estrellas"');
  });
});
