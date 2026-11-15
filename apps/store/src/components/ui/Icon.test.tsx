import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CartIcon } from "./Icon";

describe("iconos profesionales / AC-01 y AC-08", () => {
  it("renderiza un carrito SVG decorativo con color heredado", () => {
    const markup = renderToStaticMarkup(<CartIcon className="test-icon" />);

    expect(markup).toContain("<svg");
    expect(markup).toContain('class="test-icon"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('stroke="currentColor"');
  });
});
