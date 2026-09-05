const CARTO_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>`;

export function getMapTileConfig(apiKey = "") {
  const normalizedKey = apiKey.trim();

  if (!normalizedKey) {
    return {
      url: OSM_TILE_URL,
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
      provider: "osm",
    };
  }

  return {
    url: `${CARTO_TILE_URL}?key=${encodeURIComponent(normalizedKey)}`,
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
    provider: "carto",
  };
}
