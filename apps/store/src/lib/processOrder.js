const PROCESS_ORDER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-order`;
const PROCESS_ORDER_SECRET = import.meta.env.VITE_PROCESS_ORDER_SECRET;

/** Llamada directa a process-order con API key compartida. */
export async function invokeProcessOrder(orderId) {
  if (!PROCESS_ORDER_SECRET) {
    throw new Error("VITE_PROCESS_ORDER_SECRET no configurada");
  }

  const response = await fetch(PROCESS_ORDER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": PROCESS_ORDER_SECRET,
    },
    body: JSON.stringify({ order_id: orderId }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data?.error ?? text ?? `HTTP ${response.status}`);
  }

  return data;
}
