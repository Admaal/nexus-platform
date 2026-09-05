import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const destination = join(
  projectRoot,
  "apps",
  "store",
  "public",
  "fonts",
  "inter-latin.woff2",
);
const source =
  "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2";

const response = await fetch(source);
if (!response.ok) {
  throw new Error(`No se pudo descargar Inter: ${response.status}`);
}

const contentType = response.headers.get("content-type") ?? "";
if (!contentType.includes("font/woff2")) {
  throw new Error(`Formato inesperado para Inter: ${contentType || "desconocido"}`);
}

await mkdir(join(destination, ".."), { recursive: true });
const buffer = Buffer.from(await response.arrayBuffer());
await writeFile(destination, buffer);
console.log(`${destination.replace(projectRoot, "")} ${buffer.length} bytes`);
