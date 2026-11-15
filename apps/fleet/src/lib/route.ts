import rutaData from "../ruta_toledo_peligros.json";
import type { LatLon } from "../types";

/** Puntos de la ruta Toledo → Peligros como [lat, lon]. */
export function getRoutePoints(): LatLon[] {
  const coordinates = rutaData.features[0]?.geometry.coordinates ?? [];
  return coordinates.flatMap((point): LatLon[] => {
    const [lon, lat] = point;
    return lon === undefined || lat === undefined ? [] : [[lat, lon]];
  });
}
