-- Auto-invoke process-order Edge Function when a new order is inserted.
-- Avoids relying on the browser (which can timeout on long PDF+email work).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.enqueue_process_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://yiarfffsaciuodbplxus.supabase.co/functions/v1/process-order',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('order_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_process_order ON public.orders;

CREATE TRIGGER trigger_enqueue_process_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_process_order();
