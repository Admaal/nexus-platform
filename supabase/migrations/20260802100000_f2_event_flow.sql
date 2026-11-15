-- F2: flujo por eventos.
--  place_order -> pgmq (order_events) en la MISMA transaccion que el pedido -> worker (Edge Function)
--  Pasos idempotentes (order_event_steps), reintentos con backoff y DLQ (order_events_dlq).
--  La entrega es "al menos una vez": el worker es idempotente por (order_id, step).

CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT pgmq.create('order_events');
SELECT pgmq.create('order_events_dlq');

-- ========== Estado de los pasos (idempotencia + linea temporal) ==========
CREATE TABLE public.order_event_steps (
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step = ANY (ARRAY['invoice', 'email', 'shipment'])),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, step)
);

ALTER TABLE public.order_event_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leer pasos de los propios pedidos"
  ON public.order_event_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_event_steps.order_id AND o.user_id = auth.uid()
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.order_event_steps FROM anon, authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_event_steps;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- ========== Despertar al worker (optimizacion de latencia; la fiabilidad es la cola) ==========
DROP TRIGGER IF EXISTS trigger_enqueue_process_order ON public.orders;
DROP FUNCTION IF EXISTS public.enqueue_process_order();
DROP FUNCTION IF EXISTS public.dispatch_process_order(uuid);

CREATE OR REPLACE FUNCTION public.kick_order_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_key text;
  v_url text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'ORDER_WORKER_SECRET' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'ORDER_WORKER_URL' LIMIT 1;

  IF coalesce(v_key, '') = '' OR coalesce(v_url, '') = '' THEN
    RAISE NOTICE 'ORDER_WORKER_SECRET u ORDER_WORKER_URL ausentes en Vault: el worker se despertara con el barrido de pg_cron';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-API-Key', v_key),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.kick_order_worker() FROM PUBLIC, anon, authenticated;

-- Barrido de seguridad: recoge mensajes cuyo "kick" se perdio o cuyo reintento ya vence.
SELECT cron.schedule('order-worker-sweep', '* * * * *', $cron$SELECT public.kick_order_worker()$cron$);

-- ========== Encolar un evento ==========
CREATE OR REPLACE FUNCTION public.enqueue_order_event(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  PERFORM pgmq.send('order_events', jsonb_build_object(
    'event_id', gen_random_uuid(),
    'type', 'order.created',
    'order_id', p_order_id,
    'correlation_id', gen_random_uuid()
  ));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_order_event(uuid) FROM PUBLIC, anon, authenticated;

-- place_order: ahora encola order.created en la misma transaccion.
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

  PERFORM public.enqueue_order_event(v_order_id);
  PERFORM public.kick_order_worker();

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text) TO authenticated;

-- Reprocesar (redrive) un pedido: solo el propietario; reabre FAILED y vuelve a encolar.
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

  UPDATE public.orders SET status = 'PENDING', failure_reason = NULL WHERE id = p_order_id;
  PERFORM public.enqueue_order_event(p_order_id);
  PERFORM public.kick_order_worker();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_order_processing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_order_processing(uuid) TO authenticated;

-- ========== API de cola para el worker (solo service_role) ==========
CREATE OR REPLACE FUNCTION public.worker_read_events(p_qty int DEFAULT 5, p_visibility_seconds int DEFAULT 60)
RETURNS TABLE (msg_id bigint, read_ct int, payload jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT m.msg_id, m.read_ct, m.message FROM pgmq.read('order_events', p_visibility_seconds, p_qty) m;
$$;

CREATE OR REPLACE FUNCTION public.worker_ack_event(p_msg_id bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT pgmq.archive('order_events', p_msg_id);
$$;

CREATE OR REPLACE FUNCTION public.worker_retry_event(p_msg_id bigint, p_delay_seconds int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT msg_id FROM pgmq.set_vt('order_events', p_msg_id, p_delay_seconds);
$$;

CREATE OR REPLACE FUNCTION public.worker_dead_letter(p_msg_id bigint, p_payload jsonb, p_reason text, p_error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  PERFORM pgmq.send('order_events_dlq', p_payload || jsonb_build_object(
    'dlq_reason', p_reason,
    'error', p_error,
    'failed_at', now()
  ));
  PERFORM pgmq.archive('order_events', p_msg_id);

  UPDATE public.orders
     SET status = 'FAILED', failure_reason = p_reason || ': ' || p_error
   WHERE id = (p_payload->>'order_id')::uuid AND status <> 'COMPLETED';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.worker_read_events(int, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.worker_ack_event(bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.worker_retry_event(bigint, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.worker_dead_letter(bigint, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.worker_read_events(int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.worker_ack_event(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.worker_retry_event(bigint, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.worker_dead_letter(bigint, jsonb, text, text) TO service_role;

-- ========== Rate limit de la ingesta de telemetria (ventana fija por truck) ==========
CREATE TABLE public.telemetry_rate (
  truck_id TEXT NOT NULL,
  bucket TIMESTAMPTZ NOT NULL,
  hits INT NOT NULL DEFAULT 0,
  PRIMARY KEY (truck_id, bucket)
);

ALTER TABLE public.telemetry_rate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telemetry_rate FROM anon, authenticated;

-- true si el ping cabe en el limite de la ventana actual.
CREATE OR REPLACE FUNCTION public.telemetry_rate_ok(p_truck_id text, p_limit int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
BEGIN
  INSERT INTO public.telemetry_rate (truck_id, bucket, hits)
  VALUES (p_truck_id, v_bucket, 1)
  ON CONFLICT (truck_id, bucket) DO UPDATE SET hits = public.telemetry_rate.hits + 1
  RETURNING hits INTO v_hits;

  RETURN v_hits <= p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.telemetry_rate_ok(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telemetry_rate_ok(text, int, int) TO service_role;

SELECT cron.schedule(
  'telemetry-rate-cleanup', '17 * * * *',
  $cron$DELETE FROM public.telemetry_rate WHERE bucket < now() - interval '1 hour'$cron$
);
