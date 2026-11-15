import { useEffect, useState } from "react";
import { getSupabase, STARTING_POINT } from "../lib/supabase";
import { env } from "../lib/env";
import type { AddLog, LatLon } from "../types";

type TelemetryRow = {
  truck_id: string;
  lat: number | null;
  lon: number | null;
  is_deviated: boolean;
};

export function useSupabaseRealtime(addLog: AddLog, trackingId: string | null) {
  const [truckPosition, setTruckPosition] = useState<LatLon>(STARTING_POINT);
  const [isDeviated, setIsDeviated] = useState(false);

  const activeTruckId = trackingId || env.TRUCK_ID;

  useEffect(() => {
    const supabase = getSupabase();

    const channel = supabase
      .channel(`telemetry-${activeTruckId}`)
      .on<TelemetryRow>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "telemetry",
          filter: `truck_id=eq.${activeTruckId}`,
        },
        (payload) => {
          const { lat, lon, is_deviated: deviated, truck_id } = payload.new;

          if (truck_id !== activeTruckId) return;

          if (lat != null && lon != null) {
            setTruckPosition([lat, lon]);
            setIsDeviated(deviated);

            if (deviated) {
              addLog(
                `Desvío crítico detectado (>2000m) en [${lat.toFixed(2)}, ${lon.toFixed(2)}]`,
                "warning",
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [addLog, activeTruckId]);

  const resetPosition = () => {
    setTruckPosition(STARTING_POINT);
    setIsDeviated(false);
  };

  const resetDeviation = () => setIsDeviated(false);

  return { truckPosition, isDeviated, resetPosition, resetDeviation };
}
