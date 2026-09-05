import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = join(projectRoot, "apps", "store", "public", "images");

const heroSource =
  "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6";

const productSources = {
  teclado: "https://images.unsplash.com/photo-1595225476474-87563907a212",
  monitor: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf",
  auriculares: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
  raton: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46",
  laptop: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
  silla: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8",
  webcam: "https://images.unsplash.com/photo-1587826080692-f439cd0b70da",
  cable: "https://images.unsplash.com/photo-1518770660439-4636190af475",
  hub: "https://images.unsplash.com/photo-1625842268584-8f3296236761",
  escritorio: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5",
  default: "https://images.unsplash.com/photo-1518770660439-4636190af475",
};

const productWidths = [360, 640];
const heroWidths = [640, 1024, 1600];

function transformedUrl(source, width, format, quality) {
  const url = new URL(source);
  url.searchParams.set("w", width);
  url.searchParams.set("q", quality);
  url.searchParams.set("fm", format);
  url.searchParams.set("fit", "max");
  return url;
}

async function downloadAsset(source, destination, width, format, quality) {
  const response = await fetch(transformedUrl(source, width, format, quality));
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${source}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const expectedType = format === "webp" ? "image/webp" : "image/jpeg";
  if (!contentType.includes(expectedType)) {
    throw new Error(
      `Formato inesperado para ${destination}: ${contentType || "desconocido"}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(join(destination, ".."), { recursive: true });
  await writeFile(destination, buffer);
  console.log(`${destination.replace(projectRoot, "")} ${buffer.length} bytes`);
}

await mkdir(join(outputRoot, "hero"), { recursive: true });
await mkdir(join(outputRoot, "products"), { recursive: true });

for (const width of heroWidths) {
  await downloadAsset(
    heroSource,
    join(outputRoot, "hero", `hero-${width}.webp`),
    width,
    "webp",
    68,
  );
}

await downloadAsset(
  heroSource,
  join(outputRoot, "hero", "hero-fallback.jpg"),
  1600,
  "jpg",
  75,
);

for (const [key, source] of Object.entries(productSources)) {
  for (const width of productWidths) {
    await downloadAsset(
      source,
      join(outputRoot, "products", `${key}-${width}.webp`),
      width,
      "webp",
      width <= 360 ? 60 : 50,
    );
  }
}

await downloadAsset(
  productSources.default,
  join(outputRoot, "products", "product-fallback.jpg"),
  800,
  "jpg",
  75,
);
