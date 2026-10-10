-- RPC de roles atomicas: create_role_with_permissions y replace_role_permissions.
-- Cada RPC crea o reemplaza el rol y sus permisos en una sola transaccion, exige roles.manage
-- (has_permission, nunca el nombre del rol), valida que todas las claves existen en el catalogo
-- y opera solo sobre roles del salon del claim. Un fallo deja la base intacta.
begin;
select plan(17);

-- Fixtures (como postgres)
insert into auth.users (id, email, aud, role) values
  ('b0000000-0000-0000-0000-00000000000a', 'owner.rp@glowbook.test', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000c', 'citas.rp@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name) values
  ('b1000000-0000-0000-0000-000000000001', 'Salon RP A'),
  ('b1000000-0000-0000-0000-000000000002', 'Salon RP B');

insert into roles (id, salon_id, name) values
  ('b6000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Citas'),
  ('b6000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Rol ajeno');

insert into role_permissions (role_id, permission_id, salon_id) values
  ('b6000000-0000-0000-0000-000000000001',
   (select id from permissions where key = 'appointments.manage'),
   'b1000000-0000-0000-0000-000000000001'),
  ('b6000000-0000-0000-0000-000000000002',
   (select id from permissions where key = 'appointments.manage'),
   'b1000000-0000-0000-0000-000000000002');

insert into profiles (id, salon_id, role_id, is_owner, full_name) values
  ('b0000000-0000-0000-0000-00000000000a', 'b1000000-0000-0000-0000-000000000001', null, true, 'Owner RP'),
  ('b0000000-0000-0000-0000-00000000000c', 'b1000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000001', false, 'Citas RP');

-- Grants y modo de seguridad (como postgres)
select ok(
  has_function_privilege('authenticated', 'public.create_role_with_permissions(text,text[])', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.replace_role_permissions(uuid,text[])', 'EXECUTE'),
  'authenticated puede ejecutar las dos RPC de roles'
);

select ok(
  not has_function_privilege('anon', 'public.create_role_with_permissions(text,text[])', 'EXECUTE')
  and not has_function_privilege('anon', 'public.replace_role_permissions(uuid,text[])', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.create_role_with_permissions(text,text[])', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.replace_role_permissions(uuid,text[])', 'EXECUTE'),
  'anon y service_role no ejecutan las RPC de roles'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.replace_role_permissions(uuid,text[])'::regprocedure),
  false,
  'replace_role_permissions es security invoker (la RLS de roles aplica)'
);

-- Sesion del owner del salon A
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"b1000000-0000-0000-0000-000000000001"}',
  true
);

-- Crea un rol con dos permisos: el rol y sus permisos existen en el salon
select set_config(
  'test.rol_nuevo',
  public.create_role_with_permissions('Caja', array['appointments.manage', 'customers.manage'])::text,
  true
);

select ok(
  current_setting('test.rol_nuevo') <> '',
  'create_role_with_permissions devuelve el id del rol creado'
);

select is(
  (select count(*)::int from roles
    where id = current_setting('test.rol_nuevo')::uuid
      and salon_id = 'b1000000-0000-0000-0000-000000000001'),
  1,
  'el rol nuevo queda en el salon del claim'
);

select is(
  (select count(*)::int from role_permissions
    where role_id = current_setting('test.rol_nuevo')::uuid),
  2,
  'el rol nuevo recibe exactamente los permisos pedidos'
);

-- Clave inexistente: 22023 y no se crea nada
select throws_ok(
  $q$select public.create_role_with_permissions('Nula', array['appointments.manage', 'no.existe'])$q$,
  '22023',
  null,
  'create con una clave inexistente falla con 22023'
);

select is(
  (select count(*)::int from roles where name = 'Nula'),
  0,
  'un create fallido no deja el rol a medias'
);

-- Reemplazo con clave inexistente: 22023 y los permisos anteriores siguen intactos
select throws_ok(
  $q$select public.replace_role_permissions(current_setting('test.rol_nuevo')::uuid, array['appointments.manage', 'no.existe'])$q$,
  '22023',
  null,
  'replace con una clave inexistente falla con 22023'
);

select is(
  (select count(*)::int from role_permissions
    where role_id = current_setting('test.rol_nuevo')::uuid),
  2,
  'un replace fallido no toca los permisos anteriores'
);

-- Reemplazo valido: sustituye el conjunto completo
select lives_ok(
  $q$select public.replace_role_permissions(current_setting('test.rol_nuevo')::uuid, array['appointments.manage'])$q$,
  'replace con claves validas se ejecuta'
);

select is(
  (select count(*)::int from role_permissions
    where role_id = current_setting('test.rol_nuevo')::uuid),
  1,
  'replace sustituye el conjunto de permisos del rol'
);

-- Un rol del salon B no se puede reemplazar desde el salon A: P0002 y sin cambios
select throws_ok(
  $q$select public.replace_role_permissions('b6000000-0000-0000-0000-000000000002'::uuid, array['customers.manage'])$q$,
  'P0002',
  null,
  'replace de un rol de otro salon falla'
);

select throws_ok(
  $q$select public.replace_role_permissions('b6000000-0000-0000-0000-0000000000ff'::uuid, array['customers.manage'])$q$,
  'P0002',
  null,
  'replace de un rol inexistente falla'
);

-- Sin roles.manage (empleado con solo appointments.manage): 42501 en ambas RPC
select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000c","role":"authenticated","salon_id":"b1000000-0000-0000-0000-000000000001"}',
  true
);

select throws_ok(
  $q$select public.create_role_with_permissions('Sin permiso', array['appointments.manage'])$q$,
  '42501',
  null,
  'sin roles.manage no se puede crear un rol'
);

select throws_ok(
  $q$select public.replace_role_permissions('b6000000-0000-0000-0000-000000000001'::uuid, array['customers.manage'])$q$,
  '42501',
  null,
  'sin roles.manage no se pueden reemplazar permisos'
);

-- Comprobacion final como postgres: el rol del salon B no cambio
reset role;

select is(
  (select count(*)::int from role_permissions
    where role_id = 'b6000000-0000-0000-0000-000000000002'::uuid),
  1,
  'el rol del salon B conserva sus permisos tras los intentos desde el salon A'
);

select * from finish();
rollback;
