import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeroSection } from "./HeroSection";

const heroDirectory = fileURLToPath(
  new URL("../../../public/images/hero/", import.meta.url),
);

describe("HeroSection / AC-01 y AC-02", () => {
  it("marca la imagen hero como recurso LCP local y prioritario", () => {
    const markup = renderToStaticMarkup(
      <HeroSection onShopClick={() => undefined} />,
    );
    const heroImage = markup.match(/<img\b[^>]*>/i)?.[0] ?? "";

    expect(markup).toContain("/images/hero/hero-1024.webp");
    expect(markup).not.toContain("images.unsplash.com");
    expect(heroImage).toMatch(/\bfetchpriority=["']high["']/i);
    expect(heroImage).not.toMatch(/\bloading=["']lazy["']/i);
  });

  it("mantiene las variantes WebP del LCP dentro del presupuesto", async () => {
    for (const fileName of ["hero-640.webp", "hero-1024.webp", "hero-1600.webp"]) {
      const contents = await readFile(join(heroDirectory, fileName));

      expect(contents.subarray(0, 4).toString()).toBe("RIFF");
      expect(contents.subarray(8, 12).toString()).toBe("WEBP");
      expect(contents.byteLength).toBeLessThanOrEqual(200_000);
    }
  });
});
