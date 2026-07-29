-- Secure process-order trigger: send X-API-Key from Supabase Vault (same value as PROCESS_ORDER_SECRET).

CREATE OR REPLACE FUNCTION public.enqueue_process_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  api_key text;
BEGIN
  SELECT decrypted_secret INTO api_key
  FROM vault.decrypted_secrets
  WHERE name = 'PROCESS_ORDER_SECRET'
  LIMIT 1;

  IF api_key IS NULL OR api_key = '' THEN
    RAISE WARNING 'PROCESS_ORDER_SECRET missing in vault — order % not processed', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://yiarfffsaciuodbplxus.supabase.co/functions/v1/process-order',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-API-Key', api_key
    ),
    body := jsonb_build_object('order_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_process_order() FROM PUBLIC, anon, authenticated;
