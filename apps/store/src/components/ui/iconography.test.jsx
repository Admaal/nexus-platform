import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CartDrawer } from "../cart/CartDrawer";
import { Footer } from "../layout/Footer";
import { OrderCard } from "../orders/OrderCard";
import { OrdersDrawer } from "../orders/OrdersDrawer";
import { ReviewsSection } from "../sections/ReviewsSection";
import { CheckoutPage } from "../../pages/CheckoutPage";

const forbiddenIconCharacters =
  /[\u{1F000}-\u{1FAFF}\u{2100}-\u{214F}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}]/u;

const emptyCart = {
  items: [],
  itemCount: 0,
  total: 0,
  removeItem: () => undefined,
  updateQuantity: () => undefined,
};

const emptyOrders = {
  orders: [],
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
          order={{
            id: "12345678-1234-1234-1234-123456789012",
            status: "COMPLETED",
            invoice_url: "/invoice.pdf",
            total: 19.99,
            items: [],
          }}
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
