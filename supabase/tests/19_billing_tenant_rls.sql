-- Caracterizacion de billing para inquilinos (F05-C1, migracion 20240101000073_billing_tenant_rls.sql).
-- Salon A y salon B, cada uno con su plan asignado. Comprueba:
--   * planes: el asignado se ve aunque este archivado; borradores y planes ajenos no se ven.
--   * overrides, alertas y asignaciones: solo las del propio salon; columnas internas denegadas (42501).
--   * pagos: solo plataforma.
--   * modulos y limites: solo de planes visibles; anon no lee nada.
--   * count_salon_usage: el propio salon o plataforma (o service_role); otro salon -> 42501.
--     Un miembro sin permisos obtiene el mismo conteo que el owner (security definer).
--   * record_plan_alert: crea la alerta del salon de la sesion; sin salon en la sesion -> 42501.
--   * salon_plan_assignments: notes denegada al salon; el resto de columnas de facturacion, si.
-- Tabla de permisos de tabla denegado cuenta como 0 filas (como en 18_platform_rls.sql).
begin;
select plan(35);

-- Fixtures (como postgres, saltando RLS)
insert into auth.users (id, email, aud, role) values
  ('d9000000-0000-0000-0000-000000000001', 'owner.a.tap19@glowbook.test', 'authenticated', 'authenticated'),
  ('d9000000-0000-0000-0000-000000000002', 'owner.b.tap19@glowbook.test', 'authenticated', 'authenticated'),
  ('d9000000-0000-0000-0000-000000000003', 'plataforma.tap19@glowbook.test', 'authenticated', 'authenticated'),
  ('d9000000-0000-0000-0000-000000000004', 'miembro.a.tap19@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name) values
  ('d8000000-0000-0000-0000-000000000001', 'Salon Billing A'),
  ('d8000000-0000-0000-0000-000000000002', 'Salon Billing B');

insert into profiles (id, salon_id, is_owner, full_name) values
  ('d9000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', true, 'Owner A tap19'),
  ('d9000000-0000-0000-0000-000000000002', 'd8000000-0000-0000-0000-000000000002', true, 'Owner B tap19'),
  ('d9000000-0000-0000-0000-000000000004', 'd8000000-0000-0000-0000-000000000001', false, 'Miembro A tap19');

insert into platform_admins (user_id) values ('d9000000-0000-0000-0000-000000000003');

insert into commercial_plans (id, code, name, status) values
  ('d7000000-0000-0000-0000-000000000001', 'tap19_activo', 'Plan activo tap19', 'active'),
  ('d7000000-0000-0000-0000-000000000002', 'tap19_borrador', 'Plan borrador tap19', 'draft'),
  ('d7000000-0000-0000-0000-000000000003', 'tap19_archivado_a', 'Plan archivado de A tap19', 'archived'),
  ('d7000000-0000-0000-0000-000000000004', 'tap19_archivado_b', 'Plan archivado de B tap19', 'archived');

insert into commercial_plan_modules (plan_id, module_key, enabled) values
  ('d7000000-0000-0000-0000-000000000001', 'appointments', true),
  ('d7000000-0000-0000-0000-000000000002', 'retail', true),
  ('d7000000-0000-0000-0000-000000000003', 'customers', true),
  ('d7000000-0000-0000-0000-000000000004', 'services', true);

insert into commercial_plan_limits (plan_id, metric_key, max_value) values
  ('d7000000-0000-0000-0000-000000000001', 'appointments.total', 100),
  ('d7000000-0000-0000-0000-000000000004', 'appointments.total', 100);

-- A tiene su plan archivado asignado; B tiene el suyo archivado tambien
insert into salon_plan_assignments (salon_id, plan_id, status, notes) values
  ('d8000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000003', 'active', 'tap19 nota interna A'),
  ('d8000000-0000-0000-0000-000000000002', 'd7000000-0000-0000-0000-000000000004', 'active', 'tap19 nota interna B');

insert into salon_plan_overrides (salon_id, module_key, module_enabled, reason, price_override, is_gift) values
  ('d8000000-0000-0000-0000-000000000001', 'appointments', true, 'tap19 motivo A', 99, false),
  ('d8000000-0000-0000-0000-000000000002', 'appointments', true, 'tap19 motivo B', 88, true);

insert into salon_plan_alerts (salon_id, severity, message) values
  ('d8000000-0000-0000-0000-000000000001', 'warning', 'tap19 alerta A'),
  ('d8000000-0000-0000-0000-000000000002', 'warning', 'tap19 alerta B');

insert into salon_plan_payments (salon_id, plan_id, amount, period_start, period_end, notes) values
  ('d8000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000003', 10, '2030-01-01', '2030-02-01', 'tap19 pago A');

-- Helpers (solo viven en esta transaccion)
create function public.tap_count(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
exception when insufficient_privilege then
  return 0;
end $$;

-- ===== Sesion del owner del salon A =====
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d9000000-0000-0000-0000-000000000001","role":"authenticated","salon_id":"d8000000-0000-0000-0000-000000000001"}',
  true
);

select is(
  public.tap_count($q$select 1 from commercial_plans where code = 'tap19_archivado_a'$q$),
  1::bigint,
  'el salon A ve su plan asignado aunque este archivado'
);

select is(
  public.tap_count($q$select 1 from commercial_plans where code = 'tap19_borrador'$q$),
  0::bigint,
  'el salon A no ve planes en borrador'
);

select is(
  public.tap_count($q$select 1 from commercial_plans where code = 'tap19_archivado_b'$q$),
  0::bigint,
  'el salon A no ve el plan archivado asignado a B'
);

select is(
  public.tap_count($q$select 1 from commercial_plan_modules where plan_id = 'd7000000-0000-0000-0000-000000000004'$q$)
  + public.tap_count($q$select 1 from commercial_plan_limits where plan_id = 'd7000000-0000-0000-0000-000000000004'$q$),
  0::bigint,
  'el salon A no ve modulos ni limites de planes ajenos'
);

select is(
  public.tap_count($q$select 1 from commercial_plan_modules where plan_id = 'd7000000-0000-0000-0000-000000000003'$q$),
  1::bigint,
  'el salon A ve los modulos de su plan asignado archivado'
);

select is(
  public.tap_count($q$select 1 from salon_plan_assignments where salon_id = 'd8000000-0000-0000-0000-000000000002'$q$)
  + public.tap_count($q$select 1 from salon_plan_overrides where salon_id = 'd8000000-0000-0000-0000-000000000002'$q$)
  + public.tap_count($q$select 1 from salon_plan_alerts where salon_id = 'd8000000-0000-0000-0000-000000000002'$q$),
  0::bigint,
  'el salon A no ve asignaciones, overrides ni alertas de B'
);

select is(
  public.tap_count($q$select 1 from salon_plan_overrides where salon_id = 'd8000000-0000-0000-0000-000000000001'$q$),
  1::bigint,
  'control: el salon A ve sus overrides con columnas minimas'
);

select is(
  public.tap_count($q$select 1 from salon_plan_alerts where salon_id = 'd8000000-0000-0000-0000-000000000001'$q$),
  1::bigint,
  'control: el salon A ve sus alertas'
);

select throws_ok(
  $q$select reason from salon_plan_overrides$q$,
  '42501',
  null,
  'el salon A no puede leer el motivo interno (reason) de sus overrides'
);

select throws_ok(
  $q$select price_override from salon_plan_overrides$q$,
  '42501',
  null,
  'el salon A no puede leer el precio especial (price_override)'
);

select throws_ok(
  $q$select is_gift from salon_plan_overrides$q$,
  '42501',
  null,
  'el salon A no puede leer si un extra es regalo (is_gift)'
);

select is(
  public.tap_count($q$select 1 from salon_plan_payments$q$),
  0::bigint,
  'el salon A no ve sus propios pagos (solo plataforma)'
);

select is(
  public.count_salon_usage('d8000000-0000-0000-0000-000000000001', '[{"key":"k","counter":"appointments_total"}]'::jsonb) ->> 'k',
  '0',
  'count_salon_usage funciona con el propio salon'
);

select throws_ok(
  $q$select public.count_salon_usage('d8000000-0000-0000-0000-000000000002', '[{"key":"k","counter":"appointments_total"}]'::jsonb)$q$,
  '42501',
  null,
  'count_salon_usage con otro salon falla con 42501'
);

select lives_ok(
  $q$select public.record_plan_alert(null, 'appointments.total', null, 'warning', 'tap19 aviso propio')$q$,
  'record_plan_alert crea una alerta para el salon de la sesion'
);

select throws_ok(
  $q$select public.record_plan_alert(null, 'appointments.total', null, 'critica', 'tap19 severidad invalida')$q$,
  '23514',
  null,
  'record_plan_alert rechaza una severidad fuera de catalogo'
);

select is(
  public.tap_count($q$select 1 from salon_plan_alerts where message = 'tap19 aviso propio'$q$),
  1::bigint,
  'control: el salon A ve la alerta que acaba de crear'
);

-- Owner de A: nota interna denegada; columnas de facturacion concedidas; conteo de perfiles
select throws_ok(
  $q$select notes from salon_plan_assignments$q$,
  '42501',
  null,
  'el salon A no puede leer la nota interna (notes) de su asignacion'
);

select is(
  public.tap_count($q$select id, salon_id, plan_id, status, starts_at, ends_at, trial_ends_at, current_period_start, current_period_end, created_at, updated_at from salon_plan_assignments where salon_id = 'd8000000-0000-0000-0000-000000000001'$q$),
  1::bigint,
  'el salon A lee las columnas de facturacion de su asignacion'
);

select is(
  public.count_salon_usage('d8000000-0000-0000-0000-000000000001', '[{"key":"k","counter":"login_users_total"}]'::jsonb) ->> 'k',
  '2',
  'el owner de A cuenta los 2 perfiles activos de su salon'
);

-- ===== Miembro de A sin permisos especiales: mismo conteo que el owner =====
select set_config(
  'request.jwt.claims',
  '{"sub":"d9000000-0000-0000-0000-000000000004","role":"authenticated","salon_id":"d8000000-0000-0000-0000-000000000001"}',
  true
);

select throws_ok(
  $q$select notes from salon_plan_assignments$q$,
  '42501',
  null,
  'el miembro de A no puede leer la nota interna (notes)'
);

select is(
  public.count_salon_usage('d8000000-0000-0000-0000-000000000001', '[{"key":"k","counter":"login_users_total"}]'::jsonb) ->> 'k',
  '2',
  'el miembro sin permisos obtiene el mismo conteo que el owner de su salon'
);

-- ===== Sesion del owner del salon B: no puede usar A =====
select set_config(
  'request.jwt.claims',
  '{"sub":"d9000000-0000-0000-0000-000000000002","role":"authenticated","salon_id":"d8000000-0000-0000-0000-000000000002"}',
  true
);

select is(
  public.tap_count($q$select 1 from salon_plan_overrides where salon_id = 'd8000000-0000-0000-0000-000000000001'$q$)
  + public.tap_count($q$select 1 from salon_plan_alerts where salon_id = 'd8000000-0000-0000-0000-000000000001'$q$)
  + public.tap_count($q$select 1 from salon_plan_assignments where salon_id = 'd8000000-0000-0000-0000-000000000001'$q$),
  0::bigint,
  'el salon B no ve overrides, alertas ni asignaciones de A'
);

select is(
  public.tap_count($q$select 1 from commercial_plans where code = 'tap19_archivado_a'$q$),
  0::bigint,
  'el salon B no ve el plan archivado asignado a A'
);

select throws_ok(
  $q$select public.count_salon_usage('d8000000-0000-0000-0000-000000000001', '[{"key":"k","counter":"appointments_total"}]'::jsonb)$q$,
  '42501',
  null,
  'el salon B no puede contar el uso del salon A'
);

-- ===== Plataforma (sin salon en la sesion) =====
select set_config(
  'request.jwt.claims',
  '{"sub":"d9000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select is(
  public.tap_count($q$select 1 from salon_plan_payments where salon_id = 'd8000000-0000-0000-0000-000000000001'$q$),
  1::bigint,
  'plataforma ve los pagos del salon A'
);

select is(
  public.count_salon_usage('d8000000-0000-0000-0000-000000000001', '[{"key":"k","counter":"appointments_total"}]'::jsonb) ->> 'k',
  '0',
  'plataforma puede contar el uso de cualquier salon'
);

select throws_ok(
  $q$select public.record_plan_alert(null, 'appointments.total', null, 'info', 'tap19 sin salon')$q$,
  '42501',
  null,
  'record_plan_alert sin salon en la sesion falla con 42501'
);

-- ===== service_role (backend admin): sin guarda de salon =====
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(
  public.count_salon_usage('d8000000-0000-0000-0000-000000000002', '[{"key":"k","counter":"appointments_total"}]'::jsonb) ->> 'k',
  '0',
  'service_role conserva el conteo de cualquier salon'
);

-- ===== anon: no lee nada de planes ni de salones =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  public.tap_count($q$select 1 from commercial_plans$q$)
  + public.tap_count($q$select 1 from commercial_plan_modules$q$)
  + public.tap_count($q$select 1 from commercial_plan_limits$q$)
  + public.tap_count($q$select 1 from salon_plan_overrides$q$)
  + public.tap_count($q$select 1 from salon_plan_alerts$q$)
  + public.tap_count($q$select 1 from salon_plan_payments$q$),
  0::bigint,
  'anon no lee planes, modulos, limites, overrides, alertas ni pagos'
);

select is(
  public.tap_count($q$select 1 from commercial_addons$q$)
  + public.tap_count($q$select 1 from commercial_limit_metrics$q$)
  + public.tap_count($q$select 1 from platform_modules$q$),
  0::bigint,
  'anon no lee extras, metricas de limite ni modulos de plataforma'
);

select throws_ok(
  $q$select public.count_salon_usage('d8000000-0000-0000-0000-000000000001', '[]'::jsonb)$q$,
  '42501',
  null,
  'anon no puede ejecutar count_salon_usage'
);

select throws_ok(
  $q$select public.record_plan_alert(null, 'appointments.total', null, 'info', 'tap19 anon')$q$,
  '42501',
  null,
  'anon no puede ejecutar record_plan_alert'
);

-- Confirmacion como postgres: la alerta quedo en el salon A y nunca en el B
reset role;

select is(
  (select count(*)::int from salon_plan_alerts where message = 'tap19 aviso propio' and salon_id = 'd8000000-0000-0000-0000-000000000001'),
  1,
  'la alerta creada por el salon A queda asociada a A'
);

select is(
  (select count(*)::int from salon_plan_alerts where message in ('tap19 aviso propio', 'tap19 sin salon', 'tap19 anon') and salon_id = 'd8000000-0000-0000-0000-000000000002'),
  0,
  'ninguna alerta de las pruebas se ha creado para el salon B'
);

select * from finish();
rollback;
