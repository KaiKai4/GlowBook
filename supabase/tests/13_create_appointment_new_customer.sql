-- create_appointment(jsonb) con cliente nuevo (payload->'new_customer'): el alta del cliente
-- y la cita van en la MISMA transaccion. Si la cita falla (solape, validacion), no queda cliente huerfano.
-- Fecha de referencia: 2030-01-07 es lunes (dow 0); 15:00Z = 10:00 en America/Panama.
begin;
select plan(13);

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
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Corte', 30, 15);

insert into employees (id, salon_id, first_name, last_name, is_active) values
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Ana', 'Colab', true);

insert into employee_services (employee_id, service_id, salon_id) values
  ('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');

insert into employee_categories (employee_id, category_id, salon_id) values
  ('a4000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');

-- Cliente activo con telefono: el alta con ese telefono debe reutilizarlo sin renombrarlo.
insert into customers (id, salon_id, first_name, last_name, phone, is_active) values
  ('a5000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Cli', 'Con Tel', '+50769998888', true);

-- Sesion como authenticated (owner A)
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"a1000000-0000-0000-0000-000000000001"}',
  true
);

-- 1-2. Cliente nuevo + cita valida en una sola llamada
select isnt(
  (
    select public.create_appointment(jsonb_build_object(
      'notes', 'Nuevo cliente',
      'new_customer', jsonb_build_object('first_name', 'Nuevo', 'last_name', 'Cliente', 'phone', '+50761112233'),
      'items', jsonb_build_array(jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T15:00:00Z',
        'end_time', '2030-01-07T15:30:00Z',
        'ordering', 0
      ))
    ))
  ),
  null,
  'con new_customer se crea la cita y devuelve su id'
);

select is(
  (
    select count(*)::int
    from customers
    where first_name = 'Nuevo' and last_name = 'Cliente' and is_temporary and not is_active
  ),
  1,
  'el alta crea exactamente un cliente temporal inactivo'
);

-- 3-4. Solape del mismo colaborador: la cita falla y el cliente nuevo NO queda creado
select throws_ok(
  $$
    select public.create_appointment(jsonb_build_object(
      'notes', 'Solape',
      'new_customer', jsonb_build_object('first_name', 'Solape', 'last_name', 'Cliente', 'phone', '+50761119999'),
      'items', jsonb_build_array(jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T15:00:00Z',
        'end_time', '2030-01-07T15:30:00Z',
        'ordering', 0
      ))
    ))
  $$,
  '23P01',
  'conflicting key value violates exclusion constraint "no_overlap_per_employee"',
  'un solape rechaza la cita nueva'
);

select is(
  (select count(*)::int from customers where first_name = 'Solape'),
  0,
  'el solape no deja el cliente creado (rollback)'
);

-- 5-6. Validacion de la cita (duracion no coincide): tampoco queda cliente huerfano
select throws_ok(
  $$
    select public.create_appointment(jsonb_build_object(
      'notes', 'Invalida',
      'new_customer', jsonb_build_object('first_name', 'Invalido', 'last_name', 'Cliente'),
      'items', jsonb_build_array(jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T16:00:00Z',
        'end_time', '2030-01-07T16:45:00Z',
        'ordering', 0
      ))
    ))
  $$,
  'P0001',
  'La duracion del item no coincide con el servicio',
  'una validacion de la cita rechaza el alta'
);

select is(
  (select count(*)::int from customers where first_name = 'Invalido'),
  0,
  'la validacion fallida no deja el cliente creado (rollback)'
);

-- 7-8. Telefono de un cliente activo: se reutiliza y no se renombra
select isnt(
  (
    select public.create_appointment(jsonb_build_object(
      'notes', 'Reutiliza',
      'new_customer', jsonb_build_object('first_name', 'Otro', 'last_name', 'Nombre', 'phone', '+50769998888'),
      'items', jsonb_build_array(jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T17:00:00Z',
        'end_time', '2030-01-07T17:30:00Z',
        'ordering', 0
      ))
    ))
  ),
  null,
  'con un telefono activo existente la cita se crea reutilizando ese cliente'
);

select is(
  (select first_name from customers where phone = '+50769998888'),
  'Cli',
  'el cliente existente no se renombra al reutilizarlo'
);

-- 9-10. customer_id y new_customer a la vez, o ninguno: 22023
select throws_ok(
  $$
    select public.create_appointment(jsonb_build_object(
      'customer_id', 'a5000000-0000-0000-0000-000000000002',
      'new_customer', jsonb_build_object('first_name', 'Doble', 'last_name', 'Cliente'),
      'items', jsonb_build_array(jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T18:00:00Z',
        'end_time', '2030-01-07T18:30:00Z',
        'ordering', 0
      ))
    ))
  $$,
  '22023',
  'Indica un cliente existente o un cliente nuevo, no ambos ni ninguno.',
  'customer_id y new_customer a la vez se rechazan'
);

select throws_ok(
  $$
    select public.create_appointment(jsonb_build_object(
      'notes', 'Sin cliente',
      'items', jsonb_build_array(jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T18:00:00Z',
        'end_time', '2030-01-07T18:30:00Z',
        'ordering', 0
      ))
    ))
  $$,
  '22023',
  'Indica un cliente existente o un cliente nuevo, no ambos ni ninguno.',
  'sin customer_id ni new_customer se rechaza'
);

-- 11-13. Reenvio con la misma clave: devuelve la misma cita y NO crea un segundo cliente ni cita
select is(
  (
    select public.create_appointment(jsonb_build_object(
      'idempotency_key', 'c0000000-0000-0000-0000-000000000001',
      'notes', 'Idem',
      'new_customer', jsonb_build_object('first_name', 'Idem', 'last_name', 'Cliente', 'phone', '+50761115555'),
      'items', jsonb_build_array(jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T19:00:00Z',
        'end_time', '2030-01-07T19:30:00Z',
        'ordering', 0
      ))
    ))
  ),
  (
    select public.create_appointment(jsonb_build_object(
      'idempotency_key', 'c0000000-0000-0000-0000-000000000001',
      'notes', 'Idem',
      'new_customer', jsonb_build_object('first_name', 'Idem', 'last_name', 'Cliente', 'phone', '+50761115555'),
      'items', jsonb_build_array(jsonb_build_object(
        'service_id', 'a3000000-0000-0000-0000-000000000001',
        'employee_id', 'a4000000-0000-0000-0000-000000000001',
        'start_time', '2030-01-07T19:00:00Z',
        'end_time', '2030-01-07T19:30:00Z',
        'ordering', 0
      ))
    ))
  ),
  'el reenvio con la misma clave devuelve la misma cita'
);

select is(
  (select count(*)::int from customers where phone = '+50761115555'),
  1,
  'el reenvio no crea un segundo cliente'
);

select is(
  (select count(*)::int from appointments where notes = 'Idem'),
  1,
  'el reenvio no crea una segunda cita'
);

select * from finish();
rollback;
