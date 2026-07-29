-- nexus-platform unified schema
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Hide PostGIS system table from Data API / advisors
DO $$
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated, PUBLIC;
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM PUBLIC, anon, authenticated;

-- ========== COMMERCE ==========
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price > 0),
  description TEXT
);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL CHECK (customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  invoice_url TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status = ANY (ARRAY['PENDING','PROCESSING','COMPLETED','FAILED'])),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_name TEXT CHECK (length(TRIM(BOTH FROM customer_name)) > 0),
  shipping_address TEXT,
  quantity SMALLINT DEFAULT 1,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total > 0),
  user_id UUID REFERENCES auth.users(id)
);

CREATE TABLE public.keep_alive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ping_at TIMESTAMPTZ DEFAULT now()
);

-- ========== FLEET ==========
CREATE TABLE public.routes (
  id TEXT PRIMARY KEY,
  name TEXT,
  path extensions.geography(LINESTRING, 4326) NOT NULL
);

CREATE TABLE public.shipments (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status = ANY (ARRAY['PENDING','IN_TRANSIT','DELIVERED','FAILED'])),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  is_deviated BOOLEAN NOT NULL DEFAULT FALSE,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telemetry_truck_id ON public.telemetry (truck_id);
CREATE INDEX idx_telemetry_timestamp ON public.telemetry ("timestamp" DESC);

CREATE TABLE public.worker_heartbeat (
  job_name TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deviation trigger (PostGIS)
CREATE OR REPLACE FUNCTION public.check_route_deviation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  truck_point extensions.geography;
  route_path  extensions.geography;
  deviation_m DOUBLE PRECISION;
BEGIN
  truck_point := extensions.ST_SetSRID(extensions.ST_Point(NEW.lon, NEW.lat), 4326)::extensions.geography;

  SELECT path INTO route_path
  FROM public.routes
  WHERE id = 'toledo-peligros';

  IF route_path IS NULL THEN
    RETURN NEW;
  END IF;

  deviation_m := extensions.ST_Distance(truck_point, route_path);
  NEW.is_deviated := deviation_m > 2000;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_deviation
  BEFORE INSERT ON public.telemetry
  FOR EACH ROW
  EXECUTE FUNCTION public.check_route_deviation();

-- Auto-create shipment when order is inserted
CREATE OR REPLACE FUNCTION public.create_shipment_for_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.shipments (order_id, status)
  VALUES (NEW.id, 'PENDING')
  ON CONFLICT (order_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_shipment
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_shipment_for_order();

-- ========== RLS ==========
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keep_alive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_heartbeat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir a todo el mundo leer el catalogo"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir crear propios pedidos"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir leer propios pedidos"
  ON public.orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "allow_anon_select"
  ON public.keep_alive FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir lectura publica de rutas"
  ON public.routes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir lectura de shipments por tracking"
  ON public.shipments FOR SELECT
  TO anon, authenticated
  USING (
    true
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = shipments.order_id AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Permitir lectura publica de telemetria"
  ON public.telemetry FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT policy for telemetry: only service_role (Worker) inserts
CREATE POLICY "deny_worker_heartbeat_access"
  ON public.worker_heartbeat FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ========== REALTIME ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.telemetry;

-- ========== STORAGE ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read invoices"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'invoices');

CREATE POLICY "Service role upload invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Service role update invoices"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'invoices')
  WITH CHECK (bucket_id = 'invoices');
