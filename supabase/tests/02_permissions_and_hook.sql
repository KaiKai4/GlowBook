-- Caracterizacion de RBAC: is_owner(), has_permission() y del Auth Hook que inyecta salon_id.
-- En el repo las funciones viven en el esquema public (no auth): public.is_owner(),
-- public.has_permission(text), public.salon_id(). El owner (is_owner = true) hace cortocircuito.
begin;
select plan(9);

-- Fixtures (como postgres)
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner@glowbook.test', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-00000000000c', 'sin.permisos@glowbook.test', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-00000000000d', 'con.permiso@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'Salon A');

insert into roles (id, salon_id, name) values
  ('a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Sin permisos'),
  ('a6000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Citas');

insert into role_permissions (role_id, permission_id, salon_id) values
  ('a6000000-0000-0000-0000-000000000002',
   (select id from permissions where key = 'appointments.manage'),
   'a1000000-0000-0000-0000-000000000001');

insert into profiles (id, salon_id, role_id, is_owner, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', null, true, 'Owner'),
  ('a0000000-0000-0000-0000-00000000000c', 'a1000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', false, 'Sin permisos'),
  ('a0000000-0000-0000-0000-00000000000d', 'a1000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000002', false, 'Con permiso');

-- Auth Hook (se llama como postgres: authenticated no tiene EXECUTE, ver 04_security_definer_and_grants)
select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'a0000000-0000-0000-0000-00000000000a',
      'claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000a')
    )
  ) -> 'claims' ->> 'salon_id',
  'a1000000-0000-0000-0000-000000000001',
  'el Auth Hook inyecta el claim salon_id del perfil en el JWT'
);

select ok(
  not has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'EXECUTE'),
  'el Auth Hook no es ejecutable por authenticated'
);

select ok(
  not has_function_privilege('anon', 'public.custom_access_token_hook(jsonb)', 'EXECUTE'),
  'el Auth Hook no es ejecutable por anon'
);

-- Sesion como authenticated; cada identidad se fija con claims como en produccion
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"a1000000-0000-0000-0000-000000000001"}',
  true
);

select is(public.is_owner(), true, 'owner: is_owner() es true');
select ok(public.has_permission('roles.manage'), 'owner: has_permission cortocircuita y concede roles.manage');

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000c","role":"authenticated","salon_id":"a1000000-0000-0000-0000-000000000001"}',
  true
);

select is(public.is_owner(), false, 'empleado sin permisos: is_owner() es false');
select ok(
  not public.has_permission('appointments.manage'),
  'empleado sin permisos: has_permission(appointments.manage) es false'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000d","role":"authenticated","salon_id":"a1000000-0000-0000-0000-000000000001"}',
  true
);

select ok(
  public.has_permission('appointments.manage'),
  'empleado con permiso: has_permission(appointments.manage) es true'
);
select ok(
  not public.has_permission('roles.manage'),
  'empleado con permiso: no obtiene permisos que no tiene (roles.manage es false)'
);

select * from finish();
rollback;
