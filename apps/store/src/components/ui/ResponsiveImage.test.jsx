import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResponsiveImage } from "./ResponsiveImage";

describe("ResponsiveImage / AC-04, AC-05 y AC-07", () => {
  it("expone WebP responsive, lazy loading y dimensiones reservadas", () => {
    const markup = renderToStaticMarkup(
      <ResponsiveImage
        src="/images/products/monitor-640.webp"
        srcSet="/images/products/monitor-360.webp 360w, /images/products/monitor-640.webp 640w"
        sizes="33vw"
        fallbackSrc="/images/products/product-fallback.jpg"
        alt="Monitor UltraWide"
        className="product-card__image"
        loading="lazy"
        width={360}
        height={480}
      />,
    );

    expect(markup).toContain('type="image/webp"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('width="360"');
    expect(markup).toContain('height="480"');
    expect(markup).toContain('src="/images/products/product-fallback.jpg"');
  });
});
