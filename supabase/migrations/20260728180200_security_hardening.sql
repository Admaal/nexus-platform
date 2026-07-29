-- Harden SECURITY DEFINER trigger function and storage listing
REVOKE EXECUTE ON FUNCTION public.create_shipment_for_order() FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Public read invoices" ON storage.objects;
