import { useState, useCallback, useEffect, useRef } from "react";
import { useSupabaseRealtime } from "./hooks/useSupabaseRealtime";
import { useSimulation } from "./hooks/useSimulation";
import { Sidebar } from "./components/Sidebar";
import { FleetMap } from "./components/FleetMap";
import { PackageIcon } from "./components/ui/Icon";

let logIdCounter = 0;

function App() {
  const [alertsLog, setAlertsLog] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const autoStarted = useRef(false);

  const urlParams = new URLSearchParams(window.location.search);
  const trackingId = urlParams.get("tracking_id");

  const addLog = useCallback((msg, type = "info") => {
    const time = new Date().toLocaleTimeString();
    setAlertsLog((prev) => [{ id: ++logIdCounter, time, msg, type }, ...prev]);
  }, []);

  const { truckPosition, isDeviated, resetPosition, resetDeviation } =
    useSupabaseRealtime(addLog, trackingId);

  const { isSimulating, isFinished, resumeIndex, toggleSimulation, stopSimulation } =
    useSimulation(addLog, trackingId);

  useEffect(() => {
    if (trackingId && !autoStarted.current) {
      autoStarted.current = true;
      addLog(`Rastreando pedido: ${trackingId.split("-")[0].toUpperCase()}`, "success");
      
      setTimeout(() => {
        toggleSimulation();
      }, 1500);
    }
  }, [trackingId, toggleSimulation, addLog]);

  const handleToggle = () => {
    if (!isSimulating && resumeIndex === 0) {
      setAlertsLog([]);
      resetDeviation();
    }
    toggleSimulation();
  };

  const handleReset = () => {
    stopSimulation();
    resetPosition();
    setAlertsLog([]);
  };

  const closeSidebar = () => setSidebarOpen(false);
  
  const isCustomerMode = Boolean(trackingId);

  return (
    <div className="app-layout">
      
      {/* 1. MODO ADMIN: Solo mostramos el botón del menú si NO es un cliente */}
      {!sidebarOpen && !isCustomerMode && (
        <button
          className="menu-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* 2. MODO ADMIN: El Sidebar completo solo se renderiza para administradores */}
      {!isCustomerMode && (
        <>
          <div
            className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
            onClick={closeSidebar}
          />
          <Sidebar
            isSimulating={isSimulating}
            alertsLog={alertsLog}
            onToggle={handleToggle}
            onReset={handleReset}
            isOpen={sidebarOpen}
            onClose={closeSidebar}
          />
        </>
      )}

      {/* 3. MODO CLIENTE: Una tarjeta flotante bonita y de solo lectura */}
      {isCustomerMode && (
        <div className="tracking-card">
          <h3 className="tracking-card__title">
            <PackageIcon className="icon--inline" /> Rastreo de Envío
          </h3>
          <p className="tracking-card__ref">
            Pedido Ref: <strong style={{ color: "#0f172a" }}>{trackingId.split("-")[0].toUpperCase()}</strong>
          </p>
          <div className="tracking-card__status">
            <span
              className="tracking-card__dot"
              style={{
                backgroundColor: isFinished ? "#3b82f6" : (isSimulating ? "#22c55e" : "#eab308"),
              }}
            />
            <span
              className="tracking-card__label"
              style={{ color: isFinished ? "#1d4ed8" : (isSimulating ? "#15803d" : "#ca8a04") }}
            >
              {isFinished ? "¡Pedido Entregado con éxito!" : (isSimulating ? "En tránsito hacia Peligros" : "Preparando ruta...")}
            </span>
          </div>
        </div>
      )}

      {/* El mapa es común para ambos modos */}
      <FleetMap truckPosition={truckPosition} isDeviated={isDeviated} />
    </div>
  );
}

export default App;