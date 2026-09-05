function IconBase({
  children,
  className = "",
  fill = "none",
  stroke = "currentColor",
  strokeWidth = 1.8,
}) {
  return (
    <svg
      className={`fleet-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function TruckIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3 6h11v10H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </IconBase>
  );
}

export function PackageIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m4 7 8-4 8 4-8 4-8-4Z" />
      <path d="M4 7v10l8 4 8-4V7" />
      <path d="M12 11v10" />
      <path d="m8 5 8 4" />
    </IconBase>
  );
}

export function AlertIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m12 3 9 17H3L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </IconBase>
  );
}

export function CheckIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </IconBase>
  );
}

export function InfoIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </IconBase>
  );
}

export function PlayIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4V8Z" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function StopIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function RefreshIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M20 11a8 8 0 0 0-14.7-4L3 10" />
      <path d="M3 5v5h5" />
      <path d="M4 13a8 8 0 0 0 14.7 4L21 14" />
      <path d="M21 19v-5h-5" />
    </IconBase>
  );
}

export function SettingsIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      <circle cx="12" cy="12" r="4" />
    </IconBase>
  );
}

export function RocketIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M14.5 4.5c2.5-2.5 5.5-2 5.5-2s.5 3-2 5.5L13 13l-2-2 3.5-6.5Z" />
      <path d="m11 13-3 3" />
      <path d="m8 16-3 1 1-3" />
      <path d="M13 7 8 6 5 9l6 2" />
      <circle cx="16.5" cy="7.5" r="1" />
    </IconBase>
  );
}

export function FlagIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 21V4" />
      <path d="M5 5c4-3 6 3 14 0v9c-8 3-10-3-14 0" />
    </IconBase>
  );
}
