-- Rate limit compartido: public.rate_limit_buckets y public.consume_rate_limit (migracion 20240101000064).
-- Todo corre dentro de una transaccion que se revierte al final.
begin;
select plan(22);

-- Tabla protegida: RLS activa y sin privilegios para roles cliente
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rate_limit_buckets'::regclass),
  'rate_limit_buckets tiene RLS habilitada'
);

select ok(
  not has_table_privilege('anon', 'public.rate_limit_buckets', 'SELECT')
  and not has_table_privilege('authenticated', 'public.rate_limit_buckets', 'SELECT')
  and not has_table_privilege('anon', 'public.rate_limit_buckets', 'INSERT')
  and not has_table_privilege('authenticated', 'public.rate_limit_buckets', 'INSERT'),
  'anon y authenticated no tienen privilegios sobre rate_limit_buckets'
);

-- Permisos de ejecucion: solo service_role
select ok(
  not has_function_privilege('anon', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE'),
  'anon y authenticated no pueden ejecutar consume_rate_limit'
);

select ok(
  has_function_privilege('service_role', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE'),
  'service_role puede ejecutar consume_rate_limit'
);

-- Ventana: permite hasta p_max, bloquea el siguiente con retry_after > 0
select is(
  (select allowed from public.consume_rate_limit('k1', 2, 60)),
  true,
  'primer intento dentro del limite se permite'
);

select is(
  (select retry_after_seconds from public.consume_rate_limit('k1', 2, 60)),
  0,
  'un intento permitido no devuelve retry_after'
);

select is(
  (select allowed from public.consume_rate_limit('k1', 2, 60)),
  false,
  'el intento max+1 se bloquea'
);

select ok(
  (select retry_after_seconds from public.consume_rate_limit('k1', 2, 60)) between 1 and 60,
  'el intento bloqueado devuelve retry_after entre 1 y la ventana'
);

select is(
  (select count from public.rate_limit_buckets where key = 'k1'),
  3::bigint,
  'el contador se limita a p_max + 1 mientras la clave esta bloqueada'
);

-- Ventana expirada: la siguiente llamada reinicia el contador
update public.rate_limit_buckets
set expires_at = clock_timestamp() - interval '1 second'
where key = 'k1';

select is(
  (select allowed from public.consume_rate_limit('k1', 2, 60)),
  true,
  'tras expirar la ventana el intento vuelve a permitirse'
);

select is(
  (select count from public.rate_limit_buckets where key = 'k1'),
  1::bigint,
  'tras expirar la ventana el contador se reinicia a 1'
);

-- Validacion de argumentos (SQLSTATE 22023)
select throws_ok(
  $$select * from public.consume_rate_limit('k2', 0, 60)$$,
  '22023',
  'p_max debe ser mayor que 0',
  'p_max = 0 se rechaza'
);

select throws_ok(
  $$select * from public.consume_rate_limit('k2', null, 60)$$,
  '22023',
  'p_max debe ser mayor que 0',
  'p_max nulo se rechaza'
);

select throws_ok(
  $$select * from public.consume_rate_limit('k2', 1, 0)$$,
  '22023',
  'p_window_seconds debe estar entre 1 y 86400',
  'ventana de 0 segundos se rechaza'
);

select throws_ok(
  $$select * from public.consume_rate_limit('k2', 1, 86401)$$,
  '22023',
  'p_window_seconds debe estar entre 1 y 86400',
  'ventana superior a 86400 segundos se rechaza'
);

select throws_ok(
  $$select * from public.consume_rate_limit('', 1, 60)$$,
  '22023',
  'clave de rate limit inválida',
  'clave vacia se rechaza'
);

select throws_ok(
  $$select * from public.consume_rate_limit(repeat('x', 201), 1, 60)$$,
  '22023',
  'clave de rate limit inválida',
  'clave de mas de 200 caracteres se rechaza'
);

-- Limpieza acotada: como mucho 100 filas expiradas por llamada
insert into public.rate_limit_buckets (key, window_started_at, count, expires_at)
select 'exp:' || g, now() - interval '2 hours', 1, now() - interval '1 hour'
from generate_series(1, 150) g;

select is(
  (select count(*)::int from public.rate_limit_buckets where expires_at <= clock_timestamp()),
  150,
  'antes de la llamada hay 150 filas expiradas'
);

select is(
  (select allowed from public.consume_rate_limit('fresh', 5, 60)),
  true,
  'la llamada de limpieza se permite'
);

select is(
  (select count(*)::int from public.rate_limit_buckets where expires_at <= clock_timestamp()),
  50,
  'una llamada borra como mucho 100 filas expiradas'
);

-- Roles cliente no pueden invocar la funcion (permiso denegado, SQLSTATE 42501)
set local role authenticated;
select throws_ok(
  $$select * from public.consume_rate_limit('k3', 1, 60)$$,
  '42501',
  'permission denied for function consume_rate_limit',
  'authenticated no puede invocar consume_rate_limit'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.consume_rate_limit('k4', 1, 60)$$,
  '42501',
  'permission denied for function consume_rate_limit',
  'anon no puede invocar consume_rate_limit'
);
reset role;

select * from finish();
rollback;
