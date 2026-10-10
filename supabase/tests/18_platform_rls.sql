-- Caracterizacion de la RLS de plataforma (super-admin) frente a los salones.
-- Tablas: platform_admins (padmin_self), salon_invitations (inv_platform_*), salon_plan_assignments /
-- salon_plan_overrides / salon_plan_alerts / salon_plan_payments (*_select: salon propio o plataforma;
-- *_platform_write: solo plataforma), commercial_plans (archivados ocultos a salones), feedback_reports
-- (solo insert del propio salon; sin select para nadie que no sea service_role), platform_audit_log (solo plataforma).
--
-- Lectura de tablas: un fallo de permiso de tabla cuenta como 0 filas (aislado), igual que un filtro de RLS.
-- Escritura denegada: 42501 (insufficient_privilege) si no hay politica WITH CHECK, o 0 filas si la politica USING filtra.
--
-- HALLAZGOS DE SEGURIDAD (no corregidos aqui; ver bloques TODO(seguridad) al final):
--   1. Los miembros de un salon leen overrides, alertas y pagos de su propio salon (reason, notes, importes).
--   2. commercial_plans: los planes en borrador (status = 'draft') son visibles para cualquier usuario autenticado.
begin;
select plan(28);

-- Fixtures (como postgres, saltando RLS)
insert into auth.users (id, email, aud, role) values
  ('c1000000-0000-0000-0000-000000000001', 'plataforma.rls@glowbook.test', 'authenticated', 'authenticated'),
  ('c1000000-0000-0000-0000-000000000002', 'owner.a.rls@glowbook.test', 'authenticated', 'authenticated'),
  ('c1000000-0000-0000-0000-000000000003', 'owner.b.rls@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name) values
  ('c2000000-0000-0000-0000-000000000001', 'Salon RLS A'),
  ('c2000000-0000-0000-0000-000000000002', 'Salon RLS B');

insert into profiles (id, salon_id, is_owner, full_name) values
  ('c1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', true, 'Owner A RLS'),
  ('c1000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000002', true, 'Owner B RLS');

insert into platform_admins (user_id) values
  ('c1000000-0000-0000-0000-000000000001');

insert into salon_invitations (email, invited_by, salon_id, token_hash) values
  ('tap18.inv.a@glowbook.test', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'tap18-hash-a'),
  ('tap18.inv.b@glowbook.test', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'tap18-hash-b');

insert into commercial_plans (id, code, name, status, is_public) values
  ('c3000000-0000-0000-0000-000000000001', 'tap18_activo', 'Plan activo TAP', 'active', true),
  ('c3000000-0000-0000-0000-000000000002', 'tap18_draft', 'Plan borrador TAP', 'draft', false),
  ('c3000000-0000-0000-0000-000000000003', 'tap18_archivado', 'Plan archivado TAP', 'archived', false);

insert into salon_plan_assignments (salon_id, plan_id, status, notes) values
  ('c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'active', 'tap18 nota interna A'),
  ('c2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001', 'active', 'tap18 nota interna B');

insert into salon_plan_overrides (salon_id, module_key, module_enabled, reason) values
  ('c2000000-0000-0000-0000-000000000001', 'appointments', true, 'tap18 motivo interno A'),
  ('c2000000-0000-0000-0000-000000000002', 'appointments', true, 'tap18 motivo interno B');

insert into salon_plan_alerts (salon_id, severity, message) values
  ('c2000000-0000-0000-0000-000000000001', 'warning', 'tap18 alerta A'),
  ('c2000000-0000-0000-0000-000000000002', 'warning', 'tap18 alerta B');

insert into salon_plan_payments (salon_id, plan_id, amount, period_start, period_end, notes) values
  ('c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 10, '2030-01-01', '2030-02-01', 'tap18 pago A'),
  ('c2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001', 10, '2030-01-01', '2030-02-01', 'tap18 pago B');

insert into feedback_reports (salon_id, created_by, message) values
  ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'tap18 feedback A');

insert into platform_audit_log (actor_user_id, action, target_salon_id, status) values
  ('c1000000-0000-0000-0000-000000000001', 'tap18.test', 'c2000000-0000-0000-0000-000000000001', 'succeeded');

-- Helpers (se crean en la transaccion y desaparecen con el rollback).
-- Cuentan filas con la sesion actual (security invoker: aplica RLS). Permiso de tabla denegado = 0.
create function public.tap_count(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
exception when insufficient_privilege then
  return 0;
end $$;

-- Ejecuta un update/delete y devuelve las filas afectadas (0 si RLS lo filtra).
create function public.tap_write_count(p_sql text) returns bigint
language plpgsql as $$
declare n bigint := 0;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  return 0;
end $$;

-- Controles (como postgres): la siembra existe
select is(
  (select count(*) from salon_plan_assignments),
  2::bigint,
  'control: hay dos asignaciones de plan sembradas (una por salon)'
);

-- ===== Sesion del owner del salon A (miembro normal, sin ser plataforma) =====
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated","salon_id":"c2000000-0000-0000-0000-000000000001"}',
  true
);

select is(
  public.tap_count($q$select 1 from salon_plan_assignments where salon_id = 'c2000000-0000-0000-0000-000000000001'$q$),
  1::bigint,
  'control: el owner de A ve la asignacion de plan de su propio salon'
);

select is(
  public.tap_count($q$select 1 from platform_admins$q$),
  0::bigint,
  'un owner de salon no ve la tabla platform_admins'
);

select is(
  public.tap_count($q$select 1 from salon_invitations$q$),
  0::bigint,
  'un owner de salon no ve ninguna invitacion de plataforma (ni las de su propio salon)'
);

select is(
  public.tap_count($q$select 1 from platform_audit_log$q$),
  0::bigint,
  'un owner de salon no ve el registro de auditoria de plataforma'
);

select is(
  public.tap_count($q$select 1 from feedback_reports$q$),
  0::bigint,
  'un owner de salon no lee feedback_reports (ni el suyo: solo service_role lo triaja)'
);

select is(
  public.tap_count($q$select 1 from salon_plan_assignments where salon_id <> 'c2000000-0000-0000-0000-000000000001'$q$),
  0::bigint,
  'el owner de A no ve la asignacion de plan del salon B'
);

select is(
  public.tap_count($q$select 1 from salon_plan_overrides where salon_id <> 'c2000000-0000-0000-0000-000000000001'$q$)
  + public.tap_count($q$select 1 from salon_plan_alerts where salon_id <> 'c2000000-0000-0000-0000-000000000001'$q$)
  + public.tap_count($q$select 1 from salon_plan_payments where salon_id <> 'c2000000-0000-0000-0000-000000000001'$q$),
  0::bigint,
  'el owner de A no ve overrides, alertas ni pagos del salon B'
);

select is(
  public.tap_count($q$select 1 from commercial_plans where status = 'archived'$q$),
  0::bigint,
  'los planes archivados no son visibles para un salon'
);

-- Escrituras de plataforma denegadas para el owner de A
select throws_ok(
  $q$insert into platform_admins (user_id) values ('c1000000-0000-0000-0000-000000000002')$q$,
  '42501',
  null,
  'un owner de salon no puede darse de alta como administrador de plataforma'
);

select throws_ok(
  $q$insert into salon_invitations (email, invited_by, salon_id, token_hash) values
     ('intruso@glowbook.test', 'c1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'tap18-hash-intruso')$q$,
  '42501',
  null,
  'un owner de salon no puede crear invitaciones de plataforma'
);

select throws_ok(
  $q$insert into commercial_plans (code, name, status) values ('tap18_intruso', 'Intruso', 'active')$q$,
  '42501',
  null,
  'un owner de salon no puede crear planes comerciales'
);

select throws_ok(
  $q$insert into salon_plan_overrides (salon_id, module_key, module_enabled, reason)
     values ('c2000000-0000-0000-0000-000000000001', 'appointments', false, 'tap18 auto-override')$q$,
  '42501',
  null,
  'un owner de salon no puede auto-asignarse overrides de plan'
);

select throws_ok(
  $q$insert into platform_audit_log (action, status) values ('tap18.falso', 'succeeded')$q$,
  '42501',
  null,
  'un owner de salon no puede escribir en el registro de auditoria'
);

-- Feedback: el owner de A puede enviar feedback de su salon, pero no en nombre de B
select lives_ok(
  $q$insert into feedback_reports (salon_id, created_by, message)
     values ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'tap18 feedback propio')$q$,
  'control: el owner de A puede enviar feedback de su salon con created_by propio'
);

select throws_ok(
  $q$insert into feedback_reports (salon_id, created_by, message)
     values ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'tap18 feedback en B')$q$,
  '42501',
  null,
  'el owner de A no puede enviar feedback en nombre del salon B'
);

-- Escrituras silenciosamente filtradas: 0 filas afectadas (no hay politica de escritura para salones)
select is(
  public.tap_write_count($q$update salon_plan_assignments set notes = 'tap18 hackeado' where salon_id = 'c2000000-0000-0000-0000-000000000001'$q$)
  + public.tap_write_count($q$update salon_plan_assignments set notes = 'tap18 hackeado' where salon_id = 'c2000000-0000-0000-0000-000000000002'$q$)
  + public.tap_write_count($q$delete from salon_plan_alerts where salon_id = 'c2000000-0000-0000-0000-000000000001'$q$)
  + public.tap_write_count($q$delete from salon_plan_alerts where salon_id = 'c2000000-0000-0000-0000-000000000002'$q$),
  0::bigint,
  'el owner de A no puede modificar ni borrar asignaciones ni alertas (ni de su salon ni del B)'
);

-- Confirmacion (como postgres): la asignacion de A sigue intacta
reset role;
select is(
  (select notes from salon_plan_assignments where salon_id = 'c2000000-0000-0000-0000-000000000001'),
  'tap18 nota interna A',
  'tras los intentos de escritura del owner, la asignacion de A no ha cambiado'
);

-- ===== Sesion del administrador de plataforma =====
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","email":"plataforma.rls@glowbook.test"}',
  true
);

select is(
  public.tap_count($q$select 1 from platform_admins where user_id = 'c1000000-0000-0000-0000-000000000001'$q$),
  1::bigint,
  'el administrador de plataforma ve su propia fila en platform_admins'
);

select is(
  public.tap_count($q$select 1 from salon_invitations where email like 'tap18.inv.%'$q$),
  2::bigint,
  'el administrador de plataforma ve las invitaciones de ambos salones'
);

select is(
  public.tap_count($q$select 1 from platform_audit_log where action = 'tap18.test'$q$),
  1::bigint,
  'el administrador de plataforma ve el registro de auditoria'
);

select is(
  public.tap_count($q$select 1 from salon_plan_assignments where salon_id in ('c2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002')$q$),
  2::bigint,
  'el administrador de plataforma ve las asignaciones de plan de todos los salones'
);

select is(
  public.tap_count($q$select 1 from salon_plan_overrides where reason like 'tap18 motivo interno%'$q$)
  + public.tap_count($q$select 1 from salon_plan_alerts where message like 'tap18 alerta%'$q$)
  + public.tap_count($q$select 1 from salon_plan_payments where notes like 'tap18 pago%'$q$),
  6::bigint,
  'el administrador de plataforma ve overrides, alertas y pagos de ambos salones'
);

select is(
  public.tap_count($q$select 1 from commercial_plans where code = 'tap18_archivado'$q$),
  1::bigint,
  'el administrador de plataforma ve los planes archivados'
);

select is(
  public.tap_count($q$select 1 from feedback_reports$q$),
  0::bigint,
  'el administrador de plataforma tampoco lee feedback_reports por RLS (solo service_role)'
);

-- ===== Sesion del owner del salon B: no ve nada del salon A =====
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated","salon_id":"c2000000-0000-0000-0000-000000000002"}',
  true
);

select is(
  public.tap_count($q$select 1 from salon_plan_assignments where salon_id = 'c2000000-0000-0000-0000-000000000001'$q$)
  + public.tap_count($q$select 1 from salon_invitations where salon_id = 'c2000000-0000-0000-0000-000000000001'$q$)
  + public.tap_count($q$select 1 from feedback_reports where salon_id = 'c2000000-0000-0000-0000-000000000001'$q$),
  0::bigint,
  'el owner de B no ve asignaciones, invitaciones ni feedback del salon A'
);

-- ===== Anonimo: no ve nada de plataforma ni de salones =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  public.tap_count($q$select 1 from platform_admins$q$)
  + public.tap_count($q$select 1 from salon_invitations$q$)
  + public.tap_count($q$select 1 from platform_audit_log$q$)
  + public.tap_count($q$select 1 from salon_plan_assignments$q$)
  + public.tap_count($q$select 1 from salon_plan_overrides$q$)
  + public.tap_count($q$select 1 from salon_plan_alerts$q$)
  + public.tap_count($q$select 1 from salon_plan_payments$q$)
  + public.tap_count($q$select 1 from feedback_reports$q$),
  0::bigint,
  'anon no lee ninguna fila de plataforma ni de salones'
);

select throws_ok(
  $q$insert into platform_admins (user_id) values ('c1000000-0000-0000-0000-000000000003')$q$,
  '42501',
  null,
  'anon no puede darse de alta como administrador de plataforma'
);

-- ============================================================================
-- TODO(seguridad) 1: los miembros del salon leen overrides, alertas y pagos de SU salon.
-- Demostracion (sesion authenticated con salon_id = A, sin permiso salon.manage ni plataforma):
--   select reason from salon_plan_overrides where salon_id = '<salon A>';   -- devuelve 'tap18 motivo interno A'
--   select notes  from salon_plan_payments  where salon_id = '<salon A>';   -- devuelve 'tap18 pago A'
-- Politica: salon_plan_overrides_select / salon_plan_alerts_select / salon_plan_payments_select / salon_plan_assignments_select
-- (migraciones 049 y 052) usan solo "salon_id = salon_id()". Los motivos, notas e importes internos
-- no son del salon. Asercion correcta (la dejamos sin ejecutar hasta decidir la politica):
--   select is(public.tap_count($q$select 1 from salon_plan_overrides where salon_id = 'c2000000-0000-0000-0000-000000000001'$q$), 0::bigint,
--     'el owner de A no ve overrides internos de su salon');
--   (idem para salon_plan_alerts y salon_plan_payments; salon_plan_assignments.notes tambien es interna)
--
-- TODO(seguridad) 2: commercial_plans_select usa "status <> 'archived' or is_platform_admin()", asi que los
-- borradores (status = 'draft') son visibles para cualquier usuario autenticado. Demostracion:
--   select code from commercial_plans where status = 'draft';   -- como owner de A devuelve 'tap18_draft'
-- Asercion correcta:
--   select is(public.tap_count($q$select 1 from commercial_plans where status = 'draft'$q$), 0::bigint,
--     'los planes en borrador no son visibles para salones');
--
-- TODO(seguridad) 3 (informativo): commercial_plan_modules y commercial_plan_limits usan "using (... or true)":
-- son legibles por cualquier rol, incluido anon, aunque el plan asociado sea un borrador.
-- ============================================================================

select * from finish();
rollback;
