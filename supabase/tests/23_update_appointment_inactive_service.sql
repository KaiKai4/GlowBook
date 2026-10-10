-- Edicion de cita con un servicio desactivado (update_appointment(jsonb)).
--
-- Regla: al editar una cita, el servicio que ya estaba asignado puede conservarse aunque despues se
-- haya desactivado. Un servicio inactivo que la cita NO tenia debe seguir rechazandose.
-- Fecha de referencia: 2030-01-07 (dia 0 en salon_business_hours); 20:00Z = 15:00 en America/Panama.
begin;
select plan(4);

-- Fixtures (como postgres)
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner.a@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name, timezone) values
  ('a1000000-0000-0000-0000-000000000001', 'Salon A', 'America/Panama');

insert into salon_business_hours (salon_id, day_of_week, is_open, open_time, close_time) values
  ('a1000000-0000-0000-0000-000000000001', 0, true, '09:00', '17:00');

insert into profiles (id, salon_id, is_owner, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', true, 'Owner A');

insert into service_categories (id, salon_id, name) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Cortes');

insert into services (id, salon_id, category_id, name, duration_minutes, price) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Corte', 30, 15),
  ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Barba', 30, 10);

insert into employees (id, salon_id, first_name, last_name, is_active) values
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Ana', 'Colab', true);

insert into employee_services (employee_id, service_id, salon_id) values
  ('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001');

insert into employee_categories (employee_id, category_id, salon_id) values
  ('a4000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');

insert into customers (id, salon_id, first_name, last_name, is_active) values
  ('a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Cli', 'A', true);

-- Sesion como authenticated, owner A
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
      'notes', 'Servicio desactivado',
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
  'se crea una cita con el servicio Corte activo'
);

-- Se desactiva el servicio despues de asignarlo (como postgres, fuera del rol de la app)
reset role;
update services set is_active = false where id = 'a3000000-0000-0000-0000-000000000001';
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"a1000000-0000-0000-0000-000000000001"}',
  true
);

select lives_ok(
  $q$select public.update_appointment(jsonb_build_object(
    'appointment_id', (select id from appointments where notes = 'Servicio desactivado'),
    'notes', 'Servicio desactivado',
    'items', jsonb_build_array(jsonb_build_object(
      'service_id', 'a3000000-0000-0000-0000-000000000001',
      'employee_id', 'a4000000-0000-0000-0000-000000000001',
      'start_time', '2030-01-07T21:00:00Z',
      'end_time', '2030-01-07T21:30:00Z',
      'ordering', 0
    ))
  ))$q$,
  'editar la cita conservando el servicio ya desactivado no falla'
);

select is(
  (
    select count(*)::int
    from appointment_items ai
    join appointments a on a.id = ai.appointment_id
    where a.notes = 'Servicio desactivado'
      and ai.service_id = 'a3000000-0000-0000-0000-000000000001'
      and ai.start_time = '2030-01-07T21:00:00Z'
  ),
  1,
  'el item conservado queda guardado con la nueva hora'
);

-- Un servicio inactivo que la cita no tenia sigue rechazado
reset role;
update services set is_active = false where id = 'a3000000-0000-0000-0000-000000000002';
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"a1000000-0000-0000-0000-000000000001"}',
  true
);

select throws_ok(
  $q$select public.update_appointment(jsonb_build_object(
    'appointment_id', (select id from appointments where notes = 'Servicio desactivado'),
    'notes', 'Servicio desactivado',
    'items', jsonb_build_array(
      jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T21:00:00Z',
        'end_time', '2030-01-07T21:30:00Z',
        'ordering', 0
      ),
      jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000002',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T21:30:00Z',
        'end_time', '2030-01-07T22:00:00Z',
        'ordering', 1
      )
    )
  ))$q$,
  'P0001',
  'Servicio inválido para este salón',
  'añadir un servicio inactivo que la cita no tenía sigue siendo rechazado'
);

select * from finish();
rollback;
