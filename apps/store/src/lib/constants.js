const productAsset = (key) => ({
  src: `/images/products/${key}-640.webp`,
  srcSet: `/images/products/${key}-360.webp 360w, /images/products/${key}-640.webp 640w`,
});

export const PRODUCT_IMAGE_ASSETS = {
  teclado: productAsset("teclado"),
  monitor: productAsset("monitor"),
  auriculares: productAsset("auriculares"),
  raton: productAsset("raton"),
  laptop: productAsset("laptop"),
  silla: productAsset("silla"),
  webcam: productAsset("webcam"),
  cable: productAsset("cable"),
  hub: productAsset("hub"),
  escritorio: productAsset("escritorio"),
  default: productAsset("default"),
};

export const PRODUCT_IMAGES = Object.fromEntries(
  Object.entries(PRODUCT_IMAGE_ASSETS).map(([key, asset]) => [key, asset.src]),
);

const PRODUCT_MATCHERS = [
  ["teclado", "teclado"],
  ["monitor", "monitor"],
  ["auriculares", "auriculares"],
  ["ratón", "raton"],
  ["raton", "raton"],
  ["laptop", "laptop"],
  ["silla", "silla"],
  ["webcam", "webcam"],
  ["cable", "cable"],
  ["hub", "hub"],
  ["soporte", "raton"],
  ["escritorio", "escritorio"],
];

export const ORDER_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

export const getProductImageAsset = (name = "") => {
  const lower = name.toLowerCase();
  for (const [matcher, assetKey] of PRODUCT_MATCHERS) {
    if (lower.includes(matcher)) return PRODUCT_IMAGE_ASSETS[assetKey];
  }
  return PRODUCT_IMAGE_ASSETS.default;
};

export const getProductImage = (name = "") => getProductImageAsset(name).src;

export const getProductImageSources = (name = "") => ({
  ...getProductImageAsset(name),
  fallbackSrc: "/images/products/product-fallback.jpg",
  sizes: "(max-width: 480px) calc(100vw - 32px), (max-width: 860px) 50vw, 33vw",
});
