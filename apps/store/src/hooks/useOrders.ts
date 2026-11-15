import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { invokeProcessOrder } from "../lib/processOrder";
import type { CartItem, CustomerInfo, Order } from "../types";

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

  // Reintenta pedidos PENDING (el navegador a veces no llega a la Edge Function en el checkout)
  useEffect(() => {
    const pending = orders.filter((o) => o.status === "PENDING");
    if (pending.length === 0) return undefined;

    const processPending = () => {
      pending.forEach((order) => {
        invokeProcessOrder(order.id)
          .then(() => fetchOrders())
          .catch(() => {});
      });
    };

    processPending();
    const interval = setInterval(processPending, 5000);
    return () => clearInterval(interval);
  }, [orders, fetchOrders]);

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

      const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
      const orderItems = items.map((item) => ({
        product_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      const insert = {
        customer_email: customerInfo.email,
        customer_name: customerInfo.name,
        shipping_address: customerInfo.address,
        items: orderItems,
        total,
        user_id: activeUser.id,
      };

      const { data, error: insertError } = await supabase
        .from("orders")
        .insert(insert)
        .select()
        .single();

      if (insertError) {
        return { error: insertError };
      }

      const order = data as Order;

      void invokeProcessOrder(order.id).catch((err: unknown) => {
        console.warn("process-order background:", err);
      });

      await fetchOrders();

      return { error: null, order };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      return { error: { message } };
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [user, ensureAuth, fetchOrders]);

  const retryProcessOrder = useCallback(async (orderId: string) => {
    try {
      const data = await invokeProcessOrder(orderId);
      await fetchOrders();
      return { data, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { data: null, error: { message } };
    }
  }, [fetchOrders]);

  return { orders, loading, fetchOrders, createOrder, retryProcessOrder };
}
