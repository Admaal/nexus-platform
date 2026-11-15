import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

const POLL_MS = 5000;

/** Estado de envío del pedido (RPC get_shipment): el tracking_id actúa como token de capacidad. */
export function useShipmentStatus(trackingId: string | null): string | null {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!trackingId) return undefined;
    let cancelled = false;

    async function load() {
      const { data, error } = await getSupabase().rpc("get_shipment", { p_tracking_id: trackingId });
      if (cancelled || error) return;
      const row = (data as { status: string }[] | null)?.[0];
      if (row) setStatus(row.status);
    }

    void load();
    const interval = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [trackingId]);

  return status;
}
