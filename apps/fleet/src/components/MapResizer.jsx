import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** Leaflet no calcula bien el tamaño dentro de flex; forzamos recálculo al montar. */
export function MapResizer() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const t1 = setTimeout(invalidate, 0);
    const t2 = setTimeout(invalidate, 250);
    window.addEventListener("resize", invalidate);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);

  return null;
}
