BEGIN;
SELECT plan(22);

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

INSERT INTO public.products (id, name, price) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Test A', 19.99)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price;

CREATE TEMP TABLE t_ctx (order_id uuid);
GRANT ALL ON t_ctx TO PUBLIC;

CREATE FUNCTION pg_temp.as_user(uid text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

-- ===== A hace un pedido =====
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
INSERT INTO t_ctx SELECT public.place_order(
  '[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1}]'::jsonb, 'Ada', 'ada@test.local', 'Calle 1');
RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM pgmq.q_order_events WHERE message->>'order_id' = (SELECT order_id::text FROM t_ctx)),
  1, 'place_order encola exactamente un evento');

SELECT is(
  (SELECT message->>'type' FROM pgmq.q_order_events WHERE message->>'order_id' = (SELECT order_id::text FROM t_ctx)),
  'order.created', 'el evento es order.created');

SELECT ok(
  (SELECT message ? 'correlation_id' AND message ? 'event_id' FROM pgmq.q_order_events
    WHERE message->>'order_id' = (SELECT order_id::text FROM t_ctx)),
  'el evento lleva event_id y correlation_id');

SELECT hasnt_trigger('public', 'orders', 'trigger_enqueue_process_order', 'ya no hay trigger pg_net directo');

-- ===== permisos del worker =====
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
SELECT throws_ok($$SELECT * FROM public.worker_read_events(1, 30)$$, '42501', NULL, 'authenticated no puede leer la cola');
SELECT throws_ok($$SELECT public.kick_order_worker()$$, '42501', NULL, 'authenticated no puede despertar al worker');
RESET ROLE;

-- ===== worker (service_role): leer, reintentar, DLQ =====
CREATE TEMP TABLE t_msg AS
  SELECT msg_id, message FROM pgmq.q_order_events WHERE message->>'order_id' = (SELECT order_id::text FROM t_ctx);
GRANT ALL ON t_msg TO PUBLIC;

SET LOCAL ROLE service_role;

SELECT is(
  (SELECT read_ct FROM public.worker_read_events(10, 30) WHERE payload->>'order_id' = (SELECT order_id::text FROM t_ctx)),
  1, 'la primera lectura entrega read_ct = 1');

SELECT lives_ok(
  $$SELECT public.worker_retry_event((SELECT msg_id FROM t_msg), 0)$$,
  'worker_retry_event reprograma el mensaje');

SELECT is(
  (SELECT read_ct FROM public.worker_read_events(10, 30) WHERE payload->>'order_id' = (SELECT order_id::text FROM t_ctx)),
  2, 'tras reintentar, la siguiente lectura tiene read_ct = 2');

SELECT lives_ok(
  $$SELECT public.worker_dead_letter(
      (SELECT msg_id FROM t_msg),
      (SELECT message FROM t_msg),
      'PERMANENT_ERROR', 'Brevo 401')$$,
  'worker_dead_letter mueve el mensaje a la DLQ');
RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM pgmq.q_order_events WHERE msg_id = (SELECT msg_id FROM t_msg)),
  0, 'el mensaje sale de la cola principal');

SELECT is(
  (SELECT count(*)::int FROM pgmq.q_order_events_dlq WHERE message->>'order_id' = (SELECT order_id::text FROM t_ctx)),
  1, 'el mensaje está en la DLQ');

SELECT is(
  (SELECT status || '|' || failure_reason FROM public.orders WHERE id = (SELECT order_id FROM t_ctx)),
  'FAILED|PERMANENT_ERROR: Brevo 401', 'el pedido queda FAILED con el motivo');

-- ===== redrive por el propietario =====
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
SELECT lives_ok(
  $$SELECT public.request_order_processing((SELECT order_id FROM t_ctx))$$,
  'el propietario puede pedir reprocesar un pedido FAILED');
RESET ROLE;

SELECT is(
  (SELECT status FROM public.orders WHERE id = (SELECT order_id FROM t_ctx)),
  'PENDING', 'el pedido vuelve a PENDING');

SELECT is(
  (SELECT count(*)::int FROM pgmq.q_order_events WHERE message->>'order_id' = (SELECT order_id::text FROM t_ctx)),
  1, 'se encola un nuevo evento');

-- ===== pasos idempotentes y visibilidad =====
INSERT INTO public.order_event_steps (order_id, step) VALUES ((SELECT order_id FROM t_ctx), 'invoice');
SELECT throws_ok(
  $$INSERT INTO public.order_event_steps (order_id, step) VALUES ((SELECT order_id FROM t_ctx), 'invoice')$$,
  '23505', NULL, 'un paso solo se registra una vez por pedido');

SELECT pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
SELECT is((SELECT count(*)::int FROM public.order_event_steps), 0, 'B no ve los pasos de A');
RESET ROLE;

-- ===== rate limit de telemetria =====
SET LOCAL ROLE service_role;
SELECT is(public.telemetry_rate_ok('truck-x', 2, 60), true, 'rate limit: 1er ping permitido');
SELECT is(public.telemetry_rate_ok('truck-x', 2, 60), true, 'rate limit: 2o ping permitido');
SELECT is(public.telemetry_rate_ok('truck-x', 2, 60), false, 'rate limit: 3er ping bloqueado');
SELECT is(public.telemetry_rate_ok('truck-y', 2, 60), true, 'rate limit: cada truck tiene su cuenta');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
