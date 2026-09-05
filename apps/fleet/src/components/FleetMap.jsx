import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { blueIcon, redIcon } from "../constants/mapIcons";
import { env } from "../lib/env";
import { getMapTileConfig } from "../lib/mapTiles";
import { MapResizer } from "./MapResizer";
import { AlertIcon, CheckIcon } from "./ui/Icon";

/** Mapa Leaflet con marcador de posición y banner de alerta. */
export function FleetMap({ truckPosition, isDeviated }) {
  const [tileConfig, setTileConfig] = useState(() => getMapTileConfig(env.CARTO_API_KEY));

  const handleTileError = () => {
    if (tileConfig.provider === "carto") {
      setTileConfig(getMapTileConfig());
    }
  };

  return (
    <div className="map-wrapper">
      {isDeviated && (
        <div className="deviation-banner">
          <AlertIcon className="icon--inline" /> VEHÍCULO FUERA DE RUTA
        </div>
      )}
      <MapContainer
        center={[38.5, -4.0]}
        zoom={7}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <MapResizer />
        <ZoomControl position="bottomright" />
        <TileLayer
          key={tileConfig.provider}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          maxZoom={tileConfig.maxZoom}
          eventHandlers={{ tileerror: handleTileError }}
        />
        <Marker position={truckPosition} icon={isDeviated ? redIcon : blueIcon}>
          <Popup>
            <strong>Vehículo NEXUS-1</strong>
            <br />
            {isDeviated ? (
              <><AlertIcon className="icon--inline" /> Desviado</>
            ) : (
              <><CheckIcon className="icon--inline" /> Trayecto Nominal</>
            )}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
