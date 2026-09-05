import { ControlPanel } from "./ControlPanel";
import { EventConsole } from "./EventConsole";
import { TruckIcon } from "./ui/Icon";

/** Barra lateral. En móvil actúa como drawer con la clase `.open`. */
export function Sidebar({ isSimulating, alertsLog, onToggle, onReset, isOpen, onClose }) {
  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <TruckIcon className="sidebar-logo__icon" />
        </div>
        <div>
          <h1 className="sidebar-title">
            Nexus<span style={{ color: "#3b82f6" }}>Logistics</span>
          </h1>
          <p className="sidebar-subtitle">Control Central</p>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Cerrar menú">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <ControlPanel
        isSimulating={isSimulating}
        onToggle={onToggle}
        onReset={onReset}
      />

      <EventConsole alertsLog={alertsLog} />
    </aside>
  );
}
