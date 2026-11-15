-- F1: seguridad y dominio en servidor.
--  * El precio lo decide el servidor (place_order); el cliente ya no inserta en orders.
--  * shipments deja de ser legible por todos: lectura vía get_shipment(tracking_id).
--  * Facturas en bucket privado, ruta {user_id}/{order_id}.pdf, URLs firmadas.
--  * Reintento de procesado vía RPC con comprobación de propietario (sin secretos en el frontend).
--  * La URL de las Edge Functions sale de Vault, no del código.

-- ========== ORDERS: sin INSERT directo ==========
DROP POLICY IF EXISTS "Permitir crear propios pedidos" ON public.orders;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_path TEXT;
ALTER TABLE public.orders DROP COLUMN IF EXISTS invoice_url;

-- ========== place_order ==========
-- Reglas espejo de calculateOrderTotal (packages/domain/src/order.ts).
CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_email text,
  p_shipping_address text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_line jsonb;
  v_product public.products%ROWTYPE;
  v_qty numeric;
  v_snapshot jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_order_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_ORDER' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_line->'quantity') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
    END IF;
    v_qty := (v_line->>'quantity')::numeric;
    IF v_qty <= 0 OR v_qty <> trunc(v_qty) OR v_qty > 100 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
    END IF;

    BEGIN
      SELECT * INTO v_product FROM public.products WHERE id = (v_line->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'UNKNOWN_PRODUCT' USING ERRCODE = '22023';
    END;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'UNKNOWN_PRODUCT' USING ERRCODE = '22023';
    END IF;

    v_total := v_total + v_product.price * v_qty;
    v_snapshot := v_snapshot || jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'price', v_product.price,
      'quantity', v_qty
    );
  END LOOP;

  INSERT INTO public.orders (customer_email, customer_name, shipping_address, items, total, user_id)
  VALUES (p_customer_email, p_customer_name, p_shipping_address, v_snapshot, v_total, v_user)
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text) TO authenticated;

-- ========== SHIPMENTS: lectura solo del propio pedido o por tracking_id ==========
DROP POLICY IF EXISTS "Permitir lectura de shipments por tracking" ON public.shipments;

CREATE POLICY "Leer envios de los propios pedidos"
  ON public.shipments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = shipments.order_id AND o.user_id = auth.uid()
    )
  );

-- El tracking_id (UUID del pedido) actúa como token de capacidad: solo expone el estado.
CREATE OR REPLACE FUNCTION public.get_shipment(p_tracking_id uuid)
RETURNS TABLE (order_id uuid, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.order_id, s.status FROM public.shipments s WHERE s.order_id = p_tracking_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_shipment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shipment(uuid) TO anon, authenticated;

-- ========== STORAGE: bucket privado, lectura solo del propio usuario ==========
UPDATE storage.buckets SET public = false WHERE id = 'invoices';

DROP POLICY IF EXISTS "Public read invoices" ON storage.objects;
DROP POLICY IF EXISTS "Service role upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Service role update invoices" ON storage.objects;

CREATE POLICY "Leer facturas propias"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========== Despacho de process-order (URL y clave desde Vault) ==========
CREATE OR REPLACE FUNCTION public.dispatch_process_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_key text;
  v_url text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'PROCESS_ORDER_SECRET' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'PROCESS_ORDER_URL' LIMIT 1;

  IF coalesce(v_key, '') = '' OR coalesce(v_url, '') = '' THEN
    RAISE WARNING 'PROCESS_ORDER_SECRET o PROCESS_ORDER_URL ausentes en Vault: pedido % no procesado', p_order_id;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-API-Key', v_key),
    body := jsonb_build_object('order_id', p_order_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispatch_process_order(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_process_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
BEGIN
  PERFORM public.dispatch_process_order(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_process_order() FROM PUBLIC, anon, authenticated;

-- Reintento pedido por el propietario (sustituye al secreto VITE_PROCESS_ORDER_SECRET).
CREATE OR REPLACE FUNCTION public.request_order_processing(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.orders WHERE id = p_order_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'COMPLETED' THEN
    RETURN;
  END IF;
  PERFORM public.dispatch_process_order(p_order_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_order_processing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_order_processing(uuid) TO authenticated;
