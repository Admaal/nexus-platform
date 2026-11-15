BEGIN;
SELECT plan(13);

-- Fixtures: dos usuarios y un catálogo conocido (como superusuario).
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

INSERT INTO public.products (id, name, price) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Test A', 19.99),
  ('00000000-0000-0000-0000-0000000000b1', 'Test B', 5.00)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price;

CREATE TEMP TABLE t_ctx (order_id uuid);
GRANT ALL ON t_ctx TO PUBLIC;

-- Helper: actúa como un usuario autenticado concreto.
CREATE FUNCTION pg_temp.as_user(uid text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

-- ===== Usuario A =====
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');

SELECT lives_ok(
  $$INSERT INTO t_ctx SELECT public.place_order(
      '[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":2,"price":0.01},
        {"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":1}]'::jsonb,
      'Ada', 'ada@test.local', 'Calle 1')$$,
  'place_order acepta un pedido válido');

SELECT is(
  (SELECT total FROM public.orders WHERE id = (SELECT order_id FROM t_ctx)),
  44.98::numeric,
  'el total sale del catálogo (2*19.99 + 5.00), ignorando el precio del cliente');

SELECT is(
  (SELECT items->0->>'price' FROM public.orders WHERE id = (SELECT order_id FROM t_ctx)),
  '19.99',
  'el snapshot guarda el precio del catálogo');

SELECT throws_ok($$SELECT public.place_order('[]'::jsonb,'A','a@test.local','x')$$,
  '22023', 'EMPTY_ORDER', 'pedido vacío');

SELECT throws_ok(
  $$SELECT public.place_order('[{"product_id":"00000000-0000-0000-0000-0000000000ff","quantity":1}]'::jsonb,'A','a@test.local','x')$$,
  '22023', 'UNKNOWN_PRODUCT', 'producto inexistente');

SELECT throws_ok(
  $$SELECT public.place_order('[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":0}]'::jsonb,'A','a@test.local','x')$$,
  '22023', 'INVALID_QUANTITY', 'cantidad cero');

SELECT throws_ok(
  $$SELECT public.place_order('[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1.5}]'::jsonb,'A','a@test.local','x')$$,
  '22023', 'INVALID_QUANTITY', 'cantidad no entera');

SELECT throws_ok(
  $$INSERT INTO public.orders (customer_email, customer_name, items, total, user_id)
    VALUES ('a@test.local','A','[]'::jsonb, 0.01, 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', NULL, 'INSERT directo en orders denegado');

SELECT is((SELECT count(*)::int FROM public.shipments), 1, 'A ve el envío de su pedido');

-- ===== Usuario B =====
RESET ROLE;
SELECT pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');

SELECT is((SELECT count(*)::int FROM public.shipments), 0, 'B no puede listar envíos ajenos');

SELECT is(
  (SELECT count(*)::int FROM public.get_shipment((SELECT order_id FROM t_ctx))),
  1, 'get_shipment devuelve el estado a quien conoce el tracking_id');

SELECT throws_ok(
  $$SELECT public.request_order_processing((SELECT order_id FROM t_ctx))$$,
  'P0002', 'ORDER_NOT_FOUND', 'B no puede reintentar el pedido de A');

-- ===== anon =====
RESET ROLE;
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$SELECT public.place_order('[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1}]'::jsonb,'A','a@test.local','x')$$,
  '42501', NULL, 'anon no puede ejecutar place_order');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
