-- Caracterizacion de create_appointment(jsonb): cita valida, solape del mismo colaborador
-- rechazado por la exclusion no_overlap_per_employee (a nivel DB), y tenant/permiso.
-- Fecha de referencia: 2030-01-07 es lunes (dow 0); 20:00Z = 15:00 en America/Panama.
begin;
select plan(6);

-- Fixtures (como postgres)
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner.a@glowbook.test', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-00000000000c', 'sin.permiso@glowbook.test', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'owner.b@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name, timezone) values
  ('a1000000-0000-0000-0000-000000000001', 'Salon A', 'America/Panama'),
  ('b1000000-0000-0000-0000-000000000002', 'Salon B', 'America/Panama');

insert into salon_business_hours (salon_id, day_of_week, is_open, open_time, close_time) values
  ('a1000000-0000-0000-0000-000000000001', 0, true, '09:00', '17:00');

insert into profiles (id, salon_id, is_owner, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', true, 'Owner A'),
  ('b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000002', true, 'Owner B');

insert into profiles (id, salon_id, role_id, is_owner, full_name) values
  ('a0000000-0000-0000-0000-00000000000c', 'a1000000-0000-0000-0000-000000000001', null, false, 'Sin permiso');

insert into service_categories (id, salon_id, name) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Cortes');

insert into services (id, salon_id, category_id, name, duration_minutes, price) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Corte', 30, 15);

insert into employees (id, salon_id, first_name, last_name, is_active) values
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Ana', 'Colab', true);

insert into employee_services (employee_id, service_id, salon_id) values
  ('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');

insert into employee_categories (employee_id, category_id, salon_id) values
  ('a4000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');

insert into customers (id, salon_id, first_name, last_name, is_active) values
  ('a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Cli', 'A', true);

-- Sesion como authenticated; cada identidad se fija con claims como en produccion
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"a1000000-0000-0000-0000-000000000001"}',
  true
);

select isnt(
  (
    select public.create_appointment(jsonb_build_object(
      'customer_id', 'a5000000-0000-0000-0000-000000000001',
      'notes', 'Cita valida',
      'items', jsonb_build_array(jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T20:00:00Z',
        'end_time', '2030-01-07T20:30:00Z',
        'ordering', 0
      ))
    ))
  ),
  null,
  'owner A crea una cita valida y devuelve su id'
);

select is(
  (
    select count(*)::int
    from appointment_items
    where employee_id = 'a4000000-0000-0000-0000-000000000001'
      and blocks_calendar
  ),
  1,
  'la cita valida deja un item que bloquea la agenda del colaborador'
);

select throws_ok(
  $q$select public.create_appointment(jsonb_build_object(
    'customer_id', 'a5000000-0000-0000-0000-000000000001',
    'notes', 'Solape',
    'items', jsonb_build_array(jsonb_build_object(
      'service_id', 'a3000000-0000-0000-0000-000000000001',
      'employee_id', 'a4000000-0000-0000-0000-000000000001',
      'start_time', '2030-01-07T20:15:00Z',
      'end_time', '2030-01-07T20:45:00Z',
      'ordering', 0
    ))
  ))$q$,
  '23P01',
  null,
  'un solape del mismo colaborador es rechazado por no_overlap_per_employee'
);

select isnt(
  (
    select public.create_appointment(jsonb_build_object(
      'customer_id', 'a5000000-0000-0000-0000-000000000001',
      'notes', 'Contigua',
      'items', jsonb_build_array(jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T20:30:00Z',
        'end_time', '2030-01-07T21:00:00Z',
        'ordering', 0
      ))
    ))
  ),
  null,
  'control: una cita contigua (sin solape) para el mismo colaborador es aceptada'
);

-- Owner del salon B no puede usar un cliente del salon A
select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","salon_id":"b1000000-0000-0000-0000-000000000002"}',
  true
);

select throws_ok(
  $q$select public.create_appointment(jsonb_build_object(
    'customer_id', 'a5000000-0000-0000-0000-000000000001',
    'notes', 'Cross tenant',
    'items', jsonb_build_array(jsonb_build_object(
      'service_id', 'a3000000-0000-0000-0000-000000000001',
      'employee_id', 'a4000000-0000-0000-0000-000000000001',
      'start_time', '2030-01-07T20:00:00Z',
      'end_time', '2030-01-07T20:30:00Z',
      'ordering', 0
    ))
  ))$q$,
  'P0001',
  'Cliente inválido para este salón',
  'owner del salon B no puede crear citas con clientes del salon A'
);

-- Empleado sin permiso appointments.manage no puede crear citas
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000c","role":"authenticated","salon_id":"a1000000-0000-0000-0000-000000000001"}',
  true
);

select throws_ok(
  $q$select public.create_appointment(jsonb_build_object(
    'customer_id', 'a5000000-0000-0000-0000-000000000001',
    'notes', 'Sin permiso',
    'items', jsonb_build_array(jsonb_build_object(
      'service_id', 'a3000000-0000-0000-0000-000000000001',
      'employee_id', 'a4000000-0000-0000-0000-000000000001',
      'start_time', '2030-01-07T20:00:00Z',
      'end_time', '2030-01-07T20:30:00Z',
      'ordering', 0
    ))
  ))$q$,
  'P0001',
  'Sin permiso para crear citas',
  'un usuario sin appointments.manage no puede crear citas'
);

select * from finish();
rollback;
