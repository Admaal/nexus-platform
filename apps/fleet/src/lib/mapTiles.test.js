import { describe, expect, it } from "vitest";
import { getMapTileConfig } from "./mapTiles";

describe("configuración de teselas / AC-01 a AC-04", () => {
  it("usa Voyager de CARTO y añade la clave configurada", () => {
    const config = getMapTileConfig("demo-carto-key");

    expect(config.url).toContain(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    );
    expect(config.url).toContain("?key=demo-carto-key");
    expect(config.attribution).toContain("CARTO");
    expect(config.attribution).toContain("OpenStreetMap");
    expect(config.provider).toBe("carto");
  });

  it("usa OpenStreetMap cuando no existe una clave CARTO", () => {
    const config = getMapTileConfig("");

    expect(config.url).toBe("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(config.url).not.toContain("cartocdn.com");
    expect(config.attribution).toContain("OpenStreetMap");
    expect(config.provider).toBe("osm");
  });
});
