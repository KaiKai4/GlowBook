-- Caracterizacion de los triggers de privilegios sobre profiles (migraciones 005 y 014):
--   protect_profile_privileges: un usuario sin permiso no puede cambiar is_owner, role_id ni salon_id
--     (is_owner o roles.manage lo permiten). service_role se salta el guard.
--   ensure_salon_has_owner: un salon nunca se queda sin owner activo. service_role se salta el guard.
-- Orden de disparo: los BEFORE UPDATE se ejecutan por orden alfabetico del nombre del trigger, asi que
-- trg_ensure_salon_has_owner va antes que trg_protect_profile_privileges. Por eso los casos de "ultimo owner"
-- usan un owner que SI tiene permiso (is_owner), y el mensaje esperado es el de ensure.
begin;
select plan(17);

-- Fixtures (como postgres, saltando RLS)
insert into auth.users (id, email, aud, role) values
  ('e1000000-0000-0000-0000-000000000001', 'owner.s@glowbook.test', 'authenticated', 'authenticated'),
  ('e1000000-0000-0000-0000-000000000002', 'miembro.emp@glowbook.test', 'authenticated', 'authenticated'),
  ('e1000000-0000-0000-0000-000000000003', 'miembro.plain@glowbook.test', 'authenticated', 'authenticated'),
  ('e1000000-0000-0000-0000-000000000004', 'gestor.s@glowbook.test', 'authenticated', 'authenticated'),
  ('e1000000-0000-0000-0000-000000000005', 'unico.owner.t@glowbook.test', 'authenticated', 'authenticated'),
  ('e1000000-0000-0000-0000-000000000006', 'owner1.u@glowbook.test', 'authenticated', 'authenticated'),
  ('e1000000-0000-0000-0000-000000000007', 'owner2.u@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name) values
  ('e2000000-0000-0000-0000-000000000001', 'Salon S'),
  ('e2000000-0000-0000-0000-000000000002', 'Salon T'),
  ('e2000000-0000-0000-0000-000000000003', 'Salon U');

insert into roles (id, salon_id, name) values
  ('e3000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'Empleados'),
  ('e3000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 'Sin permisos'),
  ('e3000000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-000000000001', 'Gestion');

insert into role_permissions (role_id, permission_id, salon_id) values
  ('e3000000-0000-0000-0000-000000000001',
   (select id from permissions where key = 'employees.manage'),
   'e2000000-0000-0000-0000-000000000001'),
  ('e3000000-0000-0000-0000-000000000003',
   (select id from permissions where key = 'employees.manage'),
   'e2000000-0000-0000-0000-000000000001'),
  ('e3000000-0000-0000-0000-000000000003',
   (select id from permissions where key = 'roles.manage'),
   'e2000000-0000-0000-0000-000000000001');

insert into profiles (id, salon_id, role_id, is_owner, full_name) values
  ('e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', null, true, 'Owner S'),
  ('e1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000001', false, 'Miembro empleados'),
  ('e1000000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000002', false, 'Miembro plain'),
  ('e1000000-0000-0000-0000-000000000004', 'e2000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000003', false, 'Gestor'),
  ('e1000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-000000000002', null, true, 'Unico owner T'),
  ('e1000000-0000-0000-0000-000000000006', 'e2000000-0000-0000-0000-000000000003', null, true, 'Owner 1 U'),
  ('e1000000-0000-0000-0000-000000000007', 'e2000000-0000-0000-0000-000000000003', null, true, 'Owner 2 U');

-- Control: la siembra del salon S existe (si no, las pruebas serian vacuas)
select is(
  (select count(*) from profiles where salon_id = 'e2000000-0000-0000-0000-000000000001'),
  4::bigint,
  'control: el salon S tiene 4 perfiles sembrados'
);

-- Sesion del miembro sin permisos (C)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated","salon_id":"e2000000-0000-0000-0000-000000000001"}',
  true
);

select lives_ok(
  $q$update profiles set full_name = 'Miembro renombrado' where id = 'e1000000-0000-0000-0000-000000000003'$q$,
  'un miembro sin permisos puede editar su propio nombre (autoservicio)'
);

select throws_ok(
  $q$update profiles set is_owner = true where id = 'e1000000-0000-0000-0000-000000000003'$q$,
  'P0001',
  'No autorizado para cambiar privilegios del perfil',
  'un miembro sin permisos no puede subirse is_owner a si mismo'
);

select throws_ok(
  $q$update profiles set role_id = 'e3000000-0000-0000-0000-000000000003' where id = 'e1000000-0000-0000-0000-000000000003'$q$,
  'P0001',
  'No autorizado para cambiar privilegios del perfil',
  'un miembro sin permisos no puede cambiar su propio role_id por el de Gestion'
);

select throws_ok(
  $q$update profiles set salon_id = 'e2000000-0000-0000-0000-000000000002' where id = 'e1000000-0000-0000-0000-000000000003'$q$,
  'P0001',
  'No autorizado para cambiar privilegios del perfil',
  'un miembro sin permisos no puede mover su perfil a otro salon'
);

-- Sesion del miembro con employees.manage pero sin roles.manage (M)
select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated","salon_id":"e2000000-0000-0000-0000-000000000001"}',
  true
);

select throws_ok(
  $q$update profiles set is_owner = true where id = 'e1000000-0000-0000-0000-000000000003'$q$,
  'P0001',
  'No autorizado para cambiar privilegios del perfil',
  'employees.manage sin roles.manage no basta para hacer owner a un colaborador'
);

select throws_ok(
  $q$update profiles set role_id = 'e3000000-0000-0000-0000-000000000001' where id = 'e1000000-0000-0000-0000-000000000003'$q$,
  'P0001',
  'No autorizado para cambiar privilegios del perfil',
  'employees.manage sin roles.manage no basta para reasignar el role_id de otro colaborador'
);

-- Sesion del gestor con employees.manage y roles.manage (G): si puede reasignar el rol
select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated","salon_id":"e2000000-0000-0000-0000-000000000001"}',
  true
);

select lives_ok(
  $q$update profiles set role_id = 'e3000000-0000-0000-0000-000000000001' where id = 'e1000000-0000-0000-0000-000000000003'$q$,
  'con roles.manage (y employees.manage) se puede reasignar el role_id de un colaborador'
);

select is(
  (select role_id from profiles where id = 'e1000000-0000-0000-0000-000000000003'),
  'e3000000-0000-0000-0000-000000000001'::uuid,
  'el role_id reasignado por el gestor queda guardado'
);

-- Sesion del owner del salon S (is_owner = cortocircuito del guard)
select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated","salon_id":"e2000000-0000-0000-0000-000000000001"}',
  true
);

select lives_ok(
  $q$update profiles set is_owner = true where id = 'e1000000-0000-0000-0000-000000000003'$q$,
  'el owner del salon puede promover a un colaborador a owner'
);

-- Ultimo owner: la invariante se aplica aunque el owner tenga permiso (ensure va antes que protect)
-- Salon U: dos owners. El primero puede bajarse porque queda el segundo.
select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000006","role":"authenticated","salon_id":"e2000000-0000-0000-0000-000000000003"}',
  true
);

select lives_ok(
  $q$update profiles set is_owner = false where id = 'e1000000-0000-0000-0000-000000000006'$q$,
  'un owner puede bajarse si el salon conserva otro owner activo'
);

-- Ahora el owner 2 de U es el ultimo: no puede bajarse
select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000007","role":"authenticated","salon_id":"e2000000-0000-0000-0000-000000000003"}',
  true
);

select throws_ok(
  $q$update profiles set is_owner = false where id = 'e1000000-0000-0000-0000-000000000007'$q$,
  'P0001',
  'El salón debe tener al menos un owner activo',
  'el ultimo owner activo de un salon no puede bajarse'
);

-- Salon T: un unico owner, no puede desactivarse
select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000005","role":"authenticated","salon_id":"e2000000-0000-0000-0000-000000000002"}',
  true
);

select throws_ok(
  $q$update profiles set is_active = false where id = 'e1000000-0000-0000-0000-000000000005'$q$,
  'P0001',
  'El salón debe tener al menos un owner activo',
  'el ultimo owner activo no puede desactivarse'
);

-- Borrado (como postgres, sin claims): el trigger tambien protege DELETE
reset role;
select throws_ok(
  $q$delete from profiles where id = 'e1000000-0000-0000-0000-000000000005'$q$,
  'P0001',
  'El salón debe tener al menos un owner activo',
  'borrar el ultimo owner de un salon esta bloqueado por el trigger (DELETE)'
);

select is(
  (select is_owner from profiles where id = 'e1000000-0000-0000-0000-000000000005'),
  true,
  'tras el intento de borrado el owner del salon T sigue siendo owner'
);

-- Excepcion documentada: service_role salta el guard (bajas de plataforma, borrado de salon)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000005","role":"service_role","salon_id":"e2000000-0000-0000-0000-000000000002"}',
  true
);

select lives_ok(
  $q$update profiles set is_owner = false where id = 'e1000000-0000-0000-0000-000000000005'$q$,
  'service_role salta la invariante del ultimo owner'
);

select is(
  (select is_owner from profiles where id = 'e1000000-0000-0000-0000-000000000005'),
  false,
  'la baja hecha por service_role queda aplicada'
);

select * from finish();
rollback;
