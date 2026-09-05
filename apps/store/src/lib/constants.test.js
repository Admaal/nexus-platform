import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_IMAGE_ASSETS,
  getProductImage,
  getProductImageSources,
} from "./constants";

const imageDirectory = fileURLToPath(
  new URL("../../public/images/products/", import.meta.url),
);

describe("catálogo de imágenes / AC-05 y AC-06", () => {
  it("resuelve productos conocidos y desconocidos a assets locales WebP", () => {
    expect(getProductImage("Monitor UltraWide")).toBe(
      "/images/products/monitor-640.webp",
    );
    expect(getProductImage("Producto no catalogado")).toBe(
      "/images/products/default-640.webp",
    );

    const sources = getProductImageSources("Producto no catalogado");
    expect(sources.srcSet).toContain("/images/products/default-360.webp");
    expect(sources.fallbackSrc).toBe("/images/products/product-fallback.jpg");
  });

  it("mantiene todos los assets de producto como archivos WebP válidos", async () => {
    const assets = Object.values(PRODUCT_IMAGE_ASSETS);

    for (const asset of assets) {
      const fileName = asset.src.split("/").pop();
      const filePath = join(imageDirectory, fileName);
      const contents = await readFile(filePath);

      expect(contents.subarray(0, 4).toString()).toBe("RIFF");
      expect(contents.subarray(8, 12).toString()).toBe("WEBP");
      expect(contents.byteLength).toBeLessThanOrEqual(300_000);
    }
  });
});
