-- discard_temporary_customer: descarte de un cliente temporal y sus citas canceladas o no presentadas.
-- Una sola transaccion. Exige customers.manage y appointments.manage (42501), solo actua sobre clientes
-- temporales del salon del claim (P0002 si no existe en el salon, 22023 si no es temporal) y no descarta
-- clientes con citas activas o completadas (22023).
begin;
select plan(11);

-- Fixtures (como postgres)
insert into auth.users (id, email, aud, role) values
  ('d0000000-0000-0000-0000-00000000000a', 'owner.dtc@glowbook.test', 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000b', 'owner.dtc.b@glowbook.test', 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000c', 'citas.dtc@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name) values
  ('d1000000-0000-0000-0000-000000000001', 'Salon DTC A'),
  ('d1000000-0000-0000-0000-000000000002', 'Salon DTC B');

-- Rol con appointments.manage pero sin customers.manage
insert into roles (id, salon_id, name) values
  ('d6000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Solo citas');

insert into role_permissions (role_id, permission_id, salon_id) values
  ('d6000000-0000-0000-0000-000000000001',
   (select id from permissions where key = 'appointments.manage'),
   'd1000000-0000-0000-0000-000000000001');

insert into profiles (id, salon_id, role_id, is_owner, full_name) values
  ('d0000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-000000000001', null, true, 'Owner DTC A'),
  ('d0000000-0000-0000-0000-00000000000b', 'd1000000-0000-0000-0000-000000000002', null, true, 'Owner DTC B'),
  ('d0000000-0000-0000-0000-00000000000c', 'd1000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', false, 'Citas DTC');

-- Clientes del salon A: temporal con cita cancelada (feliz), no temporal, temporal con cita programada,
-- temporal con cita completada y temporal con cita cancelada para la prueba de permisos.
insert into customers (id, salon_id, first_name, last_name, phone, is_active, is_temporary) values
  ('d5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Temp', 'Feliz', '+50761000001', true, true),
  ('d5000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'No', 'Temporal', '+50761000002', true, false),
  ('d5000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'Temp', 'Activa', '+50761000003', true, true),
  ('d5000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 'Temp', 'Completada', '+50761000004', true, true),
  ('d5000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', 'Temp', 'Permiso', '+50761000005', true, true);

insert into appointments (id, salon_id, customer_id, status, notes) values
  ('d7000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'cancelled', 'DTC feliz'),
  ('d7000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000003', 'scheduled', 'DTC activa'),
  ('d7000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000004', 'completed', 'DTC completada'),
  ('d7000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000005', 'cancelled', 'DTC permiso');

-- Sesion como owner del salon A
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"d1000000-0000-0000-0000-000000000001"}',
  true
);

-- 1-2. Grants y modo de seguridad (como postgres en la sesion de prueba)
reset role;
select ok(
  has_function_privilege('authenticated', 'public.discard_temporary_customer(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.discard_temporary_customer(uuid)', 'EXECUTE'),
  'solo authenticated puede ejecutar discard_temporary_customer'
);
select ok(
  (select not prosecdef from pg_proc where oid = 'public.discard_temporary_customer(uuid)'::regprocedure),
  'discard_temporary_customer es security invoker'
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"d1000000-0000-0000-0000-000000000001"}',
  true
);

-- 3-4. Caso feliz: cliente temporal con cita cancelada. Se borran la cita y el cliente.
select lives_ok(
  $q$select public.discard_temporary_customer('d5000000-0000-0000-0000-000000000001'::uuid)$q$,
  'un owner descarta un cliente temporal cuya cita está cancelada'
);

reset role;
select is(
  (select count(*)::int from customers where id = 'd5000000-0000-0000-0000-000000000001'),
  0,
  'el cliente temporal descartado ya no existe'
);
select is(
  (select count(*)::int from appointments where customer_id = 'd5000000-0000-0000-0000-000000000001'),
  0,
  'sus citas canceladas se borran con él'
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"d1000000-0000-0000-0000-000000000001"}',
  true
);

-- 5. Cliente no temporal: no se descarta
select throws_ok(
  $q$select public.discard_temporary_customer('d5000000-0000-0000-0000-000000000002'::uuid)$q$,
  '22023',
  'Solo se pueden descartar clientes temporales.',
  'un cliente no temporal no se descarta'
);

-- 6. Cita programada activa: no se descarta
select throws_ok(
  $q$select public.discard_temporary_customer('d5000000-0000-0000-0000-000000000003'::uuid)$q$,
  '22023',
  'El cliente tiene citas activas o completadas y no se puede descartar.',
  'un cliente con cita programada no se descarta'
);

-- 7. Cita completada: no se descarta (el historial no se borra en silencio)
select throws_ok(
  $q$select public.discard_temporary_customer('d5000000-0000-0000-0000-000000000004'::uuid)$q$,
  '22023',
  'El cliente tiene citas activas o completadas y no se puede descartar.',
  'un cliente con cita completada no se descarta'
);

-- 8. Owner de otro salon: el cliente no existe en su salon
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-00000000000b","role":"authenticated","salon_id":"d1000000-0000-0000-0000-000000000002"}',
  true
);
select throws_ok(
  $q$select public.discard_temporary_customer('d5000000-0000-0000-0000-000000000005'::uuid)$q$,
  'P0002',
  'El cliente no existe en este salón.',
  'un owner de otro salón no descarta clientes ajenos'
);

-- 9. Sin customers.manage: 42501
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-00000000000c","role":"authenticated","salon_id":"d1000000-0000-0000-0000-000000000001"}',
  true
);
select throws_ok(
  $q$select public.discard_temporary_customer('d5000000-0000-0000-0000-000000000005'::uuid)$q$,
  '42501',
  'No tienes permiso para descartar clientes.',
  'sin customers.manage no se descarta un cliente temporal'
);

-- 10. El cliente del caso de permisos sigue intacto tras el rechazo
reset role;
select is(
  (select count(*)::int from customers where id = 'd5000000-0000-0000-0000-000000000005'),
  1,
  'el rechazo por permisos no borra nada'
);

select * from finish();
rollback;
