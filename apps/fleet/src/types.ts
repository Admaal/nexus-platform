export type LogType = "info" | "success" | "warning";

export interface LogEntry {
  id: number;
  time: string;
  msg: string;
  type: LogType;
}

export type AddLog = (msg: string, type?: LogType) => void;

/** [lat, lon] */
export type LatLon = [number, number];
