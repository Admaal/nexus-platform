import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { CartItem, CustomerInfo, Order } from "../types";

const INVOICE_URL_TTL_SECONDS = 60 * 10;

export interface CreateOrderResult {
  error: { message: string } | null;
  order?: Order;
  warning?: string;
}

export type Orders = ReturnType<typeof useOrders>;

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);
  const { user, ensureAuth } = useAuth();

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    // Cliente sin tipos generados: el esquema de `orders` está descrito en ../types.
    if (data && isMounted.current) setOrders(data as Order[]);
    if (error) console.error(error);
  }, [user]);

  useEffect(() => {
    isMounted.current = true;

    if (user) {
      void fetchOrders();

      const channel = supabase
        .channel("public:orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => void fetchOrders()
        )
        .subscribe();

      return () => {
        isMounted.current = false;
        void supabase.removeChannel(channel);
      };
    }

    return () => {
      isMounted.current = false;
    };
  }, [user, fetchOrders]);

  /** El servidor calcula el total con el catálogo: solo se envían ids y cantidades. */
  const createOrder = useCallback(async (
    items: CartItem[],
    customerInfo: CustomerInfo,
  ): Promise<CreateOrderResult> => {
    if (!items || items.length === 0) {
      return { error: { message: "El carrito está vacío" } };
    }

    setLoading(true);

    try {
      const activeUser = user ?? (await ensureAuth());
      if (!activeUser) {
        return { error: { message: "No se pudo iniciar sesión. Recarga la página e inténtalo de nuevo." } };
      }

      const { data: orderId, error: rpcError } = await supabase.rpc("place_order", {
        p_items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
        p_customer_name: customerInfo.name,
        p_customer_email: customerInfo.email,
        p_shipping_address: customerInfo.address,
      });

      if (rpcError) {
        return { error: rpcError };
      }

      const { data, error: readError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId as string)
        .single();

      await fetchOrders();

      if (readError || !data) {
        return { error: null, warning: "Pedido creado, pero no se pudo leer su estado todavía." };
      }

      return { error: null, order: data as Order };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      return { error: { message } };
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [user, ensureAuth, fetchOrders]);

  /** Pide al servidor que vuelva a procesar el pedido (solo el propietario). */
  const retryProcessOrder = useCallback(async (orderId: string) => {
    const { error } = await supabase.rpc("request_order_processing", { p_order_id: orderId });
    if (error) return { data: null, error: { message: error.message } };
    await fetchOrders();
    return { data: { requested: true }, error: null };
  }, [fetchOrders]);

  /** Abre la factura con una URL firmada de corta duración. */
  const openInvoice = useCallback(async (order: Order) => {
    if (!order.invoice_path) return;
    const { data, error } = await supabase.storage
      .from("invoices")
      .createSignedUrl(order.invoice_path, INVOICE_URL_TTL_SECONDS);
    if (error || !data) {
      console.error("No se pudo firmar la factura:", error);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }, []);

  return { orders, loading, fetchOrders, createOrder, retryProcessOrder, openInvoice };
}
