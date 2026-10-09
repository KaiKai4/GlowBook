-- Colaboradores atomicos (migracion 20240101000067).
-- Cubre: alta y edicion atomicas (exito y rollback completo ante fallo de asignacion),
-- idempotencia (misma clave = 1 efecto; misma clave con otros datos = 22023; error = sin clave),
-- rechazo de email de colaborador activo duplicado, invalidacion de invitacion al vaciar email,
-- aislamiento entre salones, permiso requerido y grants.
begin;
select plan(30);

-- Fixtures (como postgres)
insert into auth.users (id, email, aud, role) values
  ('c8000000-0000-0000-0000-00000000000a', 'owner.a@glowbook.test', 'authenticated', 'authenticated'),
  ('c8000000-0000-0000-0000-00000000000b', 'owner.b@glowbook.test', 'authenticated', 'authenticated'),
  ('c8000000-0000-0000-0000-00000000000c', 'sin.permiso@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name, timezone) values
  ('c8100000-0000-0000-0000-000000000001', 'Salon A', 'America/Panama'),
  ('c8100000-0000-0000-0000-000000000002', 'Salon B', 'America/Panama');

insert into profiles (id, salon_id, is_owner, full_name) values
  ('c8000000-0000-0000-0000-00000000000a', 'c8100000-0000-0000-0000-000000000001', true, 'Owner A'),
  ('c8000000-0000-0000-0000-00000000000b', 'c8100000-0000-0000-0000-000000000002', true, 'Owner B');

insert into profiles (id, salon_id, role_id, is_owner, full_name) values
  ('c8000000-0000-0000-0000-00000000000c', 'c8100000-0000-0000-0000-000000000001', null, false, 'Sin permiso');

insert into service_categories (id, salon_id, name, pricing_mode) values
  ('c8200000-0000-0000-0000-000000000001', 'c8100000-0000-0000-0000-000000000001', 'Cortes', 'fixed'),
  ('c8200000-0000-0000-0000-000000000002', 'c8100000-0000-0000-0000-000000000002', 'Cortes B', 'fixed');

insert into services (id, salon_id, category_id, name, duration_minutes, price) values
  ('c8300000-0000-0000-0000-000000000001', 'c8100000-0000-0000-0000-000000000001', 'c8200000-0000-0000-0000-000000000001', 'Corte A', 30, 15),
  ('c8300000-0000-0000-0000-000000000002', 'c8100000-0000-0000-0000-000000000002', 'c8200000-0000-0000-0000-000000000002', 'Corte B', 30, 15);

insert into employees (id, salon_id, first_name, last_name, phone, email, commission_percentage, is_active) values
  ('c8400000-0000-0000-0000-000000000001', 'c8100000-0000-0000-0000-000000000001', 'Ana', 'Colab', '600111', 'ana@glowbook.test', 25, true),
  ('c8400000-0000-0000-0000-000000000002', 'c8100000-0000-0000-0000-000000000001', 'Bea', 'Colab', '', 'bea@glowbook.test', 0, true),
  ('c8400000-0000-0000-0000-000000000003', 'c8100000-0000-0000-0000-000000000001', 'Vieja', 'Colab', '', 'old@glowbook.test', 0, false);

-- Invitacion pendiente de Bea (token ya hasheado en la tabla).
insert into employee_invitations (employee_id, salon_id, email, token_hash, expires_at) values
  ('c8400000-0000-0000-0000-000000000002', 'c8100000-0000-0000-0000-000000000001', 'bea@glowbook.test', 'hash-bea-pendiente', now() + interval '7 days');

-- Carla pertenece al salon B y no debe ser visible desde el salon A.
insert into employees (id, salon_id, first_name, last_name, is_active) values
  ('c8400000-0000-0000-0000-000000000009', 'c8100000-0000-0000-0000-000000000002', 'Carla', 'Ajena', true);

-- Sesion del owner A (authenticated), como en produccion
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"c8000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"c8100000-0000-0000-0000-000000000001"}',
  true
);

-- T01: alta atomica con asignaciones
select lives_ok(
  $q$select public.create_employee_with_assignments('{"employee":{"first_name":"Dana","last_name":"Nueva","email":"dana@glowbook.test","commission_percentage":40},"service_ids":["c8300000-0000-0000-0000-000000000001"],"category_ids":["c8200000-0000-0000-0000-000000000001"],"idempotency_key":"e8000000-0000-0000-0000-000000000001"}'::jsonb)$q$,
  'alta atomica: create_employee_with_assignments con asignaciones valida'
);

reset role;
select is(
  (select count(*)::int from employees where first_name = 'Dana' and salon_id = 'c8100000-0000-0000-0000-000000000001'),
  1,
  'alta atomica: el colaborador queda persistido una vez'
);
select is(
  (select count(*)::int from employee_services es
     join employees e on e.id = es.employee_id
    where e.first_name = 'Dana'),
  1,
  'alta atomica: la asignacion de servicio queda persistida'
);
select is(
  (select count(*)::int from employee_categories ec
     join employees e on e.id = ec.employee_id
    where e.first_name = 'Dana'),
  1,
  'alta atomica: la asignacion de categoria queda persistida'
);
set local role authenticated;

-- T02: replay con la misma clave y los mismos datos no duplica el efecto
select lives_ok(
  $q$select public.create_employee_with_assignments('{"employee":{"first_name":"Dana","last_name":"Nueva","email":"dana@glowbook.test","commission_percentage":40},"service_ids":["c8300000-0000-0000-0000-000000000001"],"category_ids":["c8200000-0000-0000-0000-000000000001"],"idempotency_key":"e8000000-0000-0000-0000-000000000001"}'::jsonb)$q$,
  'idempotencia alta: repetir la misma clave y datos devuelve el resultado guardado'
);
reset role;
select is(
  (select count(*)::int from employees where first_name = 'Dana'),
  1,
  'idempotencia alta: la repeticion no crea un segundo colaborador'
);
set local role authenticated;

-- T03: misma clave con otros datos => 22023
select throws_ok(
  $q$select public.create_employee_with_assignments('{"employee":{"first_name":"Otra","last_name":"Nueva"},"idempotency_key":"e8000000-0000-0000-0000-000000000001"}'::jsonb)$q$,
  '22023',
  'Esta solicitud ya se usó con otros datos.',
  'idempotencia alta: misma clave con otros datos es rechazada'
);

-- T04: fallo de asignacion (servicio de otro salon) => nada persistido
select throws_ok(
  $q$select public.create_employee_with_assignments('{"employee":{"first_name":"Fallo","last_name":"Asig"},"service_ids":["c8300000-0000-0000-0000-000000000002"],"idempotency_key":"e8000000-0000-0000-0000-000000000004"}'::jsonb)$q$,
  '23503',
  null,
  'alta atomica: asignar un servicio de otro salon falla'
);

reset role;
select is(
  (select count(*)::int from employees where first_name = 'Fallo'),
  0,
  'alta atomica: un fallo de asignacion no deja colaborador persistido'
);
select is(
  (select count(*)::int from idempotency_keys where idempotency_key = 'e8000000-0000-0000-0000-000000000004'),
  0,
  'alta atomica: un fallo no deja la clave de idempotencia reservada'
);
set local role authenticated;

-- T05: email de colaborador activo duplicado (sin distinguir mayusculas) => P0001 con mensaje propio
select throws_ok(
  $q$select public.create_employee_with_assignments('{"employee":{"first_name":"Dup","last_name":"X","email":"ANA@glowbook.test"}}'::jsonb)$q$,
  'P0001',
  'Ya existe un colaborador activo con ese email.',
  'email duplicado: un colaborador activo con el mismo email es rechazado'
);

-- T06: un colaborador archivado no bloquea el email en la RPC (la app lo gestiona como restauracion)
select lives_ok(
  $q$select public.create_employee_with_assignments('{"employee":{"first_name":"Nueva","last_name":"Old","email":"old@glowbook.test"}}'::jsonb)$q$,
  'email duplicado: un colaborador archivado no bloquea el alta'
);

-- T07: sin permiso employees.manage => 42501
select set_config(
  'request.jwt.claims',
  '{"sub":"c8000000-0000-0000-0000-00000000000c","role":"authenticated","salon_id":"c8100000-0000-0000-0000-000000000001"}',
  true
);
select throws_ok(
  $q$select public.create_employee_with_assignments('{"employee":{"first_name":"Sin","last_name":"Permiso"}}'::jsonb)$q$,
  '42501',
  'No tienes permiso para gestionar colaboradores.',
  'permisos: sin employees.manage no se puede dar de alta'
);

-- Vuelve a la sesion del owner A
select set_config(
  'request.jwt.claims',
  '{"sub":"c8000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"c8100000-0000-0000-0000-000000000001"}',
  true
);

-- T08: aislamiento entre salones: owner B no puede editar un colaborador del salon A
select set_config(
  'request.jwt.claims',
  '{"sub":"c8000000-0000-0000-0000-00000000000b","role":"authenticated","salon_id":"c8100000-0000-0000-0000-000000000002"}',
  true
);
select throws_ok(
  $q$select public.update_employee_profile('{"employee_id":"c8400000-0000-0000-0000-000000000001","fields":{"first_name":"Intruso"}}'::jsonb)$q$,
  'P0002',
  'Colaborador no encontrado.',
  'aislamiento: owner de otro salon no puede editar el colaborador'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"c8000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"c8100000-0000-0000-0000-000000000001"}',
  true
);

-- T09: edicion parcial: solo se escribe lo presente (telefono, comision y email se conservan)
select lives_ok(
  $q$select public.update_employee_profile('{"employee_id":"c8400000-0000-0000-0000-000000000001","fields":{"first_name":"Ana Maria"},"service_ids":["c8300000-0000-0000-0000-000000000001"],"category_ids":["c8200000-0000-0000-0000-000000000001"]}'::jsonb)$q$,
  'edicion parcial: actualizar solo el nombre es valida'
);
reset role;
select is(
  (select first_name || '|' || phone || '|' || email || '|' || commission_percentage::text
     from employees where id = 'c8400000-0000-0000-0000-000000000001'),
  'Ana Maria|600111|ana@glowbook.test|25.00',
  'edicion parcial: telefono, email y comision no se pisan al editar solo el nombre'
);
set local role authenticated;

-- T10: fallo de asignacion en la edicion => ningun cambio persistido (rollback completo)
select throws_ok(
  $q$select public.update_employee_profile('{"employee_id":"c8400000-0000-0000-0000-000000000001","fields":{"first_name":"Rollback"},"service_ids":["c8300000-0000-0000-0000-000000000002"]}'::jsonb)$q$,
  '23503',
  null,
  'edicion atomica: asignar un servicio de otro salon falla'
);
reset role;
select is(
  (select first_name from employees where id = 'c8400000-0000-0000-0000-000000000001'),
  'Ana Maria',
  'edicion atomica: un fallo de asignacion no cambia el perfil'
);
set local role authenticated;

-- T11: vaciar el email sin cuenta vinculada invalida la invitacion pendiente
select lives_ok(
  $q$select public.update_employee_profile('{"employee_id":"c8400000-0000-0000-0000-000000000002","fields":{"email":""}}'::jsonb)$q$,
  'invitacion: vaciar el email de un colaborador sin cuenta es valido'
);
reset role;
select is(
  (select count(*)::int from employee_invitations where employee_id = 'c8400000-0000-0000-0000-000000000002'),
  0,
  'invitacion: vaciar el email invalida la invitacion pendiente'
);
select is(
  (select email from employees where id = 'c8400000-0000-0000-0000-000000000002'),
  '',
  'invitacion: el email queda vacio'
);
set local role authenticated;

-- T12: email de colaborador activo duplicado en la edicion => P0001 con mensaje propio
select throws_ok(
  $q$select public.update_employee_profile('{"employee_id":"c8400000-0000-0000-0000-000000000001","fields":{"email":"DANA@glowbook.test"}}'::jsonb)$q$,
  'P0001',
  'Ya existe un colaborador activo con ese email.',
  'email duplicado: la edicion no puede usar el email de otro colaborador activo'
);

-- T13: idempotencia de la edicion: la repeticion con la misma clave no vuelve a escribir
select lives_ok(
  $q$select public.update_employee_profile('{"employee_id":"c8400000-0000-0000-0000-000000000001","fields":{"specialty":"Color"},"idempotency_key":"e8000000-0000-0000-0000-000000000013"}'::jsonb)$q$,
  'idempotencia edicion: primera llamada con clave'
);
reset role;
update employees set first_name = 'Manual' where id = 'c8400000-0000-0000-0000-000000000001';
set local role authenticated;
select lives_ok(
  $q$select public.update_employee_profile('{"employee_id":"c8400000-0000-0000-0000-000000000001","fields":{"specialty":"Color"},"idempotency_key":"e8000000-0000-0000-0000-000000000013"}'::jsonb)$q$,
  'idempotencia edicion: repetir la misma clave y datos devuelve el resultado guardado'
);
reset role;
select is(
  (select first_name from employees where id = 'c8400000-0000-0000-0000-000000000001'),
  'Manual',
  'idempotencia edicion: la repeticion no vuelve a escribir (1 efecto)'
);

-- T14: grants minimos
select ok(
  not has_function_privilege('anon', 'public.create_employee_with_assignments(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_employee_profile(jsonb)', 'EXECUTE'),
  'grants: anon no ejecuta las RPC de colaboradores'
);
select ok(
  has_function_privilege('authenticated', 'public.create_employee_with_assignments(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.update_employee_profile(jsonb)', 'EXECUTE'),
  'grants: authenticated ejecuta las RPC de colaboradores'
);
select ok(
  not has_function_privilege('authenticated', 'public.replace_employee_assignments(jsonb)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.replace_employee_assignments(jsonb)', 'EXECUTE'),
  'grants: el helper de asignaciones no es ejecutable por roles cliente'
);

-- T15: indice unico parcial de email activo por salon
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'employees_active_email_per_salon_unique'
  ),
  'indice: email de colaborador activo unico por salon'
);

-- T16: search_path fijado en las funciones nuevas
select ok(
  (select bool_and(coalesce(p.proconfig @> array['search_path=public, pg_temp'], false))
     from pg_proc p
    where p.proname in ('create_employee_with_assignments', 'update_employee_profile', 'replace_employee_assignments')),
  'seguridad: las funciones nuevas fijan search_path'
);

select * from finish();
rollback;
