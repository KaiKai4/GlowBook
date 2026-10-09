-- Idempotencia de escrituras criticas y transiciones atomicas de cita (migracion 20240101000065).
-- Cubre: misma clave + mismos datos => 1 efecto y mismo resultado; misma clave + otros datos => 22023;
-- error en la RPC => no queda clave y el reintento funciona; sin clave => conducta anterior;
-- cancelar/no_show/completar liberan o cierran la cita de forma atomica; aislamiento entre salones.
-- Fecha de referencia: 2030-01-07 es lunes; 14:00Z = 09:00 en America/Panama (horario 09:00-17:00).
begin;
select plan(49);

-- Fixtures (como postgres)
insert into auth.users (id, email, aud, role) values
  ('c6000000-0000-0000-0000-00000000000a', 'owner.a@glowbook.test', 'authenticated', 'authenticated'),
  ('c6000000-0000-0000-0000-00000000000b', 'owner.b@glowbook.test', 'authenticated', 'authenticated'),
  ('c6000000-0000-0000-0000-00000000000c', 'sin.permiso@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name, timezone) values
  ('c6100000-0000-0000-0000-000000000001', 'Salon A', 'America/Panama'),
  ('c6100000-0000-0000-0000-000000000002', 'Salon B', 'America/Panama');

insert into salon_business_hours (salon_id, day_of_week, is_open, open_time, close_time) values
  ('c6100000-0000-0000-0000-000000000001', 0, true, '09:00', '17:00');

insert into profiles (id, salon_id, is_owner, full_name) values
  ('c6000000-0000-0000-0000-00000000000a', 'c6100000-0000-0000-0000-000000000001', true, 'Owner A'),
  ('c6000000-0000-0000-0000-00000000000b', 'c6100000-0000-0000-0000-000000000002', true, 'Owner B');

insert into profiles (id, salon_id, role_id, is_owner, full_name) values
  ('c6000000-0000-0000-0000-00000000000c', 'c6100000-0000-0000-0000-000000000001', null, false, 'Sin permiso');

insert into service_categories (id, salon_id, name, pricing_mode) values
  ('c6200000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-000000000001', 'Cortes', 'fixed'),
  ('c6200000-0000-0000-0000-000000000002', 'c6100000-0000-0000-0000-000000000001', 'Color', 'variable');

insert into services (id, salon_id, category_id, name, duration_minutes, price) values
  ('c6300000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-000000000001', 'c6200000-0000-0000-0000-000000000001', 'Corte', 30, 15),
  ('c6300000-0000-0000-0000-000000000002', 'c6100000-0000-0000-0000-000000000001', 'c6200000-0000-0000-0000-000000000002', 'Tinte', 30, 20);

insert into employees (id, salon_id, first_name, last_name, is_active) values
  ('c6400000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-000000000001', 'Ana', 'Colab', true);

insert into employee_services (employee_id, service_id, salon_id) values
  ('c6400000-0000-0000-0000-000000000001', 'c6300000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-000000000001'),
  ('c6400000-0000-0000-0000-000000000001', 'c6300000-0000-0000-0000-000000000002', 'c6100000-0000-0000-0000-000000000001');

insert into employee_categories (employee_id, category_id, salon_id) values
  ('c6400000-0000-0000-0000-000000000001', 'c6200000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-000000000001'),
  ('c6400000-0000-0000-0000-000000000001', 'c6200000-0000-0000-0000-000000000002', 'c6100000-0000-0000-0000-000000000001');

insert into customers (id, salon_id, first_name, last_name, is_active) values
  ('c6500000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-000000000001', 'Cli', 'A', true);

insert into inventory_products (id, salon_id, name) values
  ('c6600000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-000000000001', 'Shampoo');

insert into inventory_stock_locations (salon_id, product_id, location, quantity) values
  ('c6100000-0000-0000-0000-000000000001', 'c6600000-0000-0000-0000-000000000001', 'retail', 10),
  ('c6100000-0000-0000-0000-000000000001', 'c6600000-0000-0000-0000-000000000001', 'internal', 0),
  ('c6100000-0000-0000-0000-000000000001', 'c6600000-0000-0000-0000-000000000001', 'storage', 20);

-- Sesion del owner A (authenticated), como en produccion
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"c6000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"c6100000-0000-0000-0000-000000000001"}',
  true
);

-- Payloads de cita (GUC transaccional para no repetir JSON)
select set_config('glowbook.p_k1', $j${
  "customer_id": "c6500000-0000-0000-0000-000000000001",
  "notes": "Clave K1",
  "idempotency_key": "d1000000-0000-0000-0000-000000000001",
  "items": [{"service_id": "c6300000-0000-0000-0000-000000000001", "employee_id": "c6400000-0000-0000-0000-000000000001", "start_time": "2030-01-07T14:00:00Z", "end_time": "2030-01-07T14:30:00Z", "ordering": 0}]
}$j$, true);

select set_config('glowbook.p_k1_otros', $j${
  "customer_id": "c6500000-0000-0000-0000-000000000001",
  "notes": "Clave K1 con otros datos",
  "idempotency_key": "d1000000-0000-0000-0000-000000000001",
  "items": [{"service_id": "c6300000-0000-0000-0000-000000000001", "employee_id": "c6400000-0000-0000-0000-000000000001", "start_time": "2030-01-07T14:00:00Z", "end_time": "2030-01-07T14:30:00Z", "ordering": 0}]
}$j$, true);

select set_config('glowbook.p_k2_error', $j${
  "customer_id": "c6500000-0000-0000-0000-000000000001",
  "notes": "Clave K2",
  "idempotency_key": "d1000000-0000-0000-0000-000000000002",
  "items": [{"service_id": "c6300000-0000-0000-0000-000000000001", "employee_id": "c6400000-0000-0000-0000-000000000001", "start_time": "2030-01-07T14:15:00Z", "end_time": "2030-01-07T14:45:00Z", "ordering": 0}]
}$j$, true);

select set_config('glowbook.p_k2_reintento', $j${
  "customer_id": "c6500000-0000-0000-0000-000000000001",
  "notes": "Clave K2 reintento",
  "idempotency_key": "d1000000-0000-0000-0000-000000000002",
  "items": [{"service_id": "c6300000-0000-0000-0000-000000000001", "employee_id": "c6400000-0000-0000-0000-000000000001", "start_time": "2030-01-07T14:30:00Z", "end_time": "2030-01-07T15:00:00Z", "ordering": 0}]
}$j$, true);

-- A. create_appointment con clave

-- T01: primera llamada con clave crea la cita
select set_config('glowbook.k1', (select public.create_appointment(current_setting('glowbook.p_k1')::jsonb))::text, true);
select isnt(current_setting('glowbook.k1'), null, 'create con clave: la primera llamada crea la cita');

-- T02: misma clave y mismos datos => mismo resultado (sin efecto duplicado)
select is(
  (select public.create_appointment(current_setting('glowbook.p_k1')::jsonb))::text,
  current_setting('glowbook.k1'),
  'create con clave: la repeticion devuelve el mismo appointment_id'
);

-- T03: y solo existe una cita con esa clave
select is(
  (select count(*)::int from appointments where notes = 'Clave K1'),
  1,
  'create con clave: la repeticion no crea una cita nueva'
);

-- T04: misma clave con otros datos => 22023
select throws_ok(
  $q$select public.create_appointment(current_setting('glowbook.p_k1_otros')::jsonb)$q$,
  '22023',
  'Esta solicitud ya se usó con otros datos.',
  'create con clave: misma clave con otros datos es rechazada'
);

-- T05: error de la RPC (solape de agenda) => se revierte, incluida la clave
select throws_ok(
  $q$select public.create_appointment(current_setting('glowbook.p_k2_error')::jsonb)$q$,
  '23P01',
  null,
  'create con clave: un error de la RPC (solape) se propaga'
);

-- T06: tras el error no queda clave reservada (comprobado como postgres)
reset role;
select is(
  (select count(*)::int from idempotency_keys where idempotency_key = 'd1000000-0000-0000-0000-000000000002'),
  0,
  'error en la RPC: no queda ninguna clave reservada'
);
set local role authenticated;

-- T07: el reintento con la misma clave y datos corregidos funciona
select isnt(
  (select public.create_appointment(current_setting('glowbook.p_k2_reintento')::jsonb)),
  null,
  'error en la RPC: el reintento con la misma clave se ejecuta'
);

-- T08: sin clave => conducta anterior (cada llamada crea una cita)
select set_config('glowbook.sc1', (select public.create_appointment(jsonb_build_object(
  'customer_id', 'c6500000-0000-0000-0000-000000000001',
  'notes', 'Sin clave',
  'items', jsonb_build_array(jsonb_build_object(
    'service_id', 'c6300000-0000-0000-0000-000000000001',
    'employee_id', 'c6400000-0000-0000-0000-000000000001',
    'start_time', '2030-01-07T15:30:00Z',
    'end_time', '2030-01-07T16:00:00Z',
    'ordering', 0)))))::text, true);
select set_config('glowbook.sc2', (select public.create_appointment(jsonb_build_object(
  'customer_id', 'c6500000-0000-0000-0000-000000000001',
  'notes', 'Sin clave',
  'items', jsonb_build_array(jsonb_build_object(
    'service_id', 'c6300000-0000-0000-0000-000000000001',
    'employee_id', 'c6400000-0000-0000-0000-000000000001',
    'start_time', '2030-01-07T16:00:00Z',
    'end_time', '2030-01-07T16:30:00Z',
    'ordering', 0)))))::text, true);
select is(
  (select count(*)::int from appointments where notes = 'Sin clave'),
  2,
  'sin clave: cada llamada crea su cita (conducta anterior)'
);

-- B. update_appointment con clave

select set_config('glowbook.x8', (select public.create_appointment(jsonb_build_object(
  'customer_id', 'c6500000-0000-0000-0000-000000000001',
  'notes', 'X8',
  'items', jsonb_build_array(jsonb_build_object(
    'service_id', 'c6300000-0000-0000-0000-000000000001',
    'employee_id', 'c6400000-0000-0000-0000-000000000001',
    'start_time', '2030-01-07T16:30:00Z',
    'end_time', '2030-01-07T17:00:00Z',
    'ordering', 0)))))::text, true);

select set_config('glowbook.p_upd', jsonb_build_object(
  'appointment_id', current_setting('glowbook.x8'),
  'notes', 'X8 editada',
  'idempotency_key', 'd1000000-0000-0000-0000-000000000003',
  'items', jsonb_build_array(jsonb_build_object(
    'service_id', 'c6300000-0000-0000-0000-000000000001',
    'employee_id', 'c6400000-0000-0000-0000-000000000001',
    'start_time', '2030-01-07T16:30:00Z',
    'end_time', '2030-01-07T17:00:00Z',
    'ordering', 0))
)::text, true);

-- T09: update con clave se aplica
select lives_ok(
  $q$select public.update_appointment(current_setting('glowbook.p_upd')::jsonb)$q$,
  'update con clave: la primera llamada se aplica'
);

-- T10: tras cerrar la cita (como postgres), la repeticion con la misma clave sigue siendo un exito
reset role;
update appointments set status = 'completed' where id = current_setting('glowbook.x8')::uuid;
set local role authenticated;

select lives_ok(
  $q$select public.update_appointment(current_setting('glowbook.p_upd')::jsonb)$q$,
  'update con clave: la repeticion devuelve el resultado guardado aunque la cita ya este cerrada'
);

-- C. Transiciones de estado atomicas (cita con items y calendario)

select set_config('glowbook.x2', (select public.create_appointment(jsonb_build_object(
  'customer_id', 'c6500000-0000-0000-0000-000000000001', 'notes', 'X2',
  'items', jsonb_build_array(jsonb_build_object('service_id', 'c6300000-0000-0000-0000-000000000001',
    'employee_id', 'c6400000-0000-0000-0000-000000000001', 'start_time', '2030-01-07T17:00:00Z',
    'end_time', '2030-01-07T17:30:00Z', 'ordering', 0)))))::text, true);

select set_config('glowbook.x3', (select public.create_appointment(jsonb_build_object(
  'customer_id', 'c6500000-0000-0000-0000-000000000001', 'notes', 'X3',
  'items', jsonb_build_array(jsonb_build_object('service_id', 'c6300000-0000-0000-0000-000000000002',
    'employee_id', 'c6400000-0000-0000-0000-000000000001', 'start_time', '2030-01-07T17:30:00Z',
    'end_time', '2030-01-07T18:00:00Z', 'ordering', 0)))))::text, true);

select set_config('glowbook.x4', (select public.create_appointment(jsonb_build_object(
  'customer_id', 'c6500000-0000-0000-0000-000000000001', 'notes', 'X4',
  'items', jsonb_build_array(jsonb_build_object('service_id', 'c6300000-0000-0000-0000-000000000001',
    'employee_id', 'c6400000-0000-0000-0000-000000000001', 'start_time', '2030-01-07T18:00:00Z',
    'end_time', '2030-01-07T18:30:00Z', 'ordering', 0)))))::text, true);

select set_config('glowbook.x5', (select public.create_appointment(jsonb_build_object(
  'customer_id', 'c6500000-0000-0000-0000-000000000001', 'notes', 'X5',
  'items', jsonb_build_array(jsonb_build_object('service_id', 'c6300000-0000-0000-0000-000000000001',
    'employee_id', 'c6400000-0000-0000-0000-000000000001', 'start_time', '2030-01-07T18:30:00Z',
    'end_time', '2030-01-07T19:00:00Z', 'ordering', 0)))))::text, true);

select set_config('glowbook.x6', (select public.create_appointment(jsonb_build_object(
  'customer_id', 'c6500000-0000-0000-0000-000000000001', 'notes', 'X6',
  'items', jsonb_build_array(jsonb_build_object('service_id', 'c6300000-0000-0000-0000-000000000001',
    'employee_id', 'c6400000-0000-0000-0000-000000000001', 'start_time', '2030-01-07T19:00:00Z',
    'end_time', '2030-01-07T19:30:00Z', 'ordering', 0)))))::text, true);

select set_config('glowbook.x7', (select public.create_appointment(jsonb_build_object(
  'customer_id', 'c6500000-0000-0000-0000-000000000001', 'notes', 'X7',
  'items', jsonb_build_array(jsonb_build_object('service_id', 'c6300000-0000-0000-0000-000000000001',
    'employee_id', 'c6400000-0000-0000-0000-000000000001', 'start_time', '2030-01-07T19:30:00Z',
    'end_time', '2030-01-07T20:00:00Z', 'ordering', 0)))))::text, true);

-- T11: un owner de otro salon no puede cancelar la cita (aislamiento entre salones)
select set_config('request.jwt.claims',
  '{"sub":"c6000000-0000-0000-0000-00000000000b","role":"authenticated","salon_id":"c6100000-0000-0000-0000-000000000002"}', true);
select throws_ok(
  $q$select public.cancel_appointment(jsonb_build_object('appointment_id', current_setting('glowbook.x5')))$q$,
  'P0001',
  'Cita no encontrada.',
  'aislamiento: el owner del salon B no puede cancelar citas del salon A'
);
select set_config('request.jwt.claims',
  '{"sub":"c6000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"c6100000-0000-0000-0000-000000000001"}', true);

-- T12: empleado sin appointments.manage no puede cancelar
select set_config('request.jwt.claims',
  '{"sub":"c6000000-0000-0000-0000-00000000000c","role":"authenticated","salon_id":"c6100000-0000-0000-0000-000000000001"}', true);
select throws_ok(
  $q$select public.mark_no_show(jsonb_build_object('appointment_id', current_setting('glowbook.x6')))$q$,
  'P0001',
  'No tienes permiso para gestionar citas.',
  'permiso: sin appointments.manage no se puede marcar no_show'
);
select set_config('request.jwt.claims',
  '{"sub":"c6000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"c6100000-0000-0000-0000-000000000001"}', true);

-- Cancelacion con clave de X5
select set_config('glowbook.cancel_x5', (select public.cancel_appointment(jsonb_build_object(
  'appointment_id', current_setting('glowbook.x5'),
  'idempotency_key', 'd1000000-0000-0000-0000-000000000004'
)))::text, true);

-- T13: cancelar cambia el estado y libera la agenda (blocks_calendar = false en todos los items)
select ok(
  (select status = 'cancelled' from appointments where id = current_setting('glowbook.x5')::uuid)
  and (select count(*) = 0 from appointment_items where appointment_id = current_setting('glowbook.x5')::uuid and blocks_calendar),
  'cancelar: cabecera cancelada y items con blocks_calendar = false'
);

-- T14: repetir la cancelacion con la misma clave devuelve el resultado guardado
select lives_ok(
  $q$select public.cancel_appointment(jsonb_build_object(
    'appointment_id', current_setting('glowbook.x5'),
    'idempotency_key', 'd1000000-0000-0000-0000-000000000004'))$q$,
  'cancelar con clave: la repeticion no falla aunque la cita ya este cancelada'
);

-- T15: la agenda liberada admite una cita solapada en el mismo horario del colaborador
select isnt(
  (select public.create_appointment(jsonb_build_object(
    'customer_id', 'c6500000-0000-0000-0000-000000000001',
    'notes', 'Solape tras cancelar',
    'items', jsonb_build_array(jsonb_build_object(
      'service_id', 'c6300000-0000-0000-0000-000000000001',
      'employee_id', 'c6400000-0000-0000-0000-000000000001',
      'start_time', '2030-01-07T18:30:00Z',
      'end_time', '2030-01-07T19:00:00Z',
      'ordering', 0)))))::text,
  null,
  'cancelar libera la agenda: el horario queda disponible para otra cita'
);

-- Completar X2 con descuento del 10% sobre un servicio de precio fijo (15 => 13.50)
select set_config('glowbook.complete_x2', (select public.complete_appointment(jsonb_build_object(
  'appointment_id', current_setting('glowbook.x2'),
  'payment_method', 'cash',
  'completion_price_note', '  Cliente fiel  ',
  'item_charges', jsonb_build_array(jsonb_build_object(
    'id', (select id from appointment_items where appointment_id = current_setting('glowbook.x2')::uuid),
    'price', 15,
    'discount_percentage', 10))
)))::text, true);

-- T16: completar fija estado, total cobrado, descuento y libera la agenda
select ok(
  (select status = 'completed' and total_price = 13.5 and discount_amount = 1.5 and payment_method = 'cash'
          and completion_price_note = 'Cliente fiel'
   from appointments where id = current_setting('glowbook.x2')::uuid)
  and (select count(*) = 0 from appointment_items where appointment_id = current_setting('glowbook.x2')::uuid and blocks_calendar),
  'completar: total 13.50, descuento 1.50, nota recortada y agenda liberada'
);

-- T17: una cita completada no puede cancelarse
select throws_ok(
  $q$select public.cancel_appointment(jsonb_build_object('appointment_id', current_setting('glowbook.x2')))$q$,
  'P0001',
  'No se puede cambiar el estado de "completed" a "cancelled".',
  'transicion invalida: una cita completada no se puede cancelar'
);

-- T18: cambiar el precio de un servicio de precio fijo es rechazado
select throws_ok(
  $q$select public.complete_appointment(jsonb_build_object(
    'appointment_id', current_setting('glowbook.x4'),
    'payment_method', 'cash',
    'item_charges', jsonb_build_array(jsonb_build_object(
      'id', (select id from appointment_items where appointment_id = current_setting('glowbook.x4')::uuid),
      'price', 16))))$q$,
  'P0001',
  'Solo puedes cambiar el precio de servicios con precio variable.',
  'completar: no se puede cambiar el precio de un servicio de precio fijo'
);

-- T19: en una categoria de precio variable el nuevo precio se cobra (25, sin descuento)
select lives_ok(
  $q$select public.complete_appointment(jsonb_build_object(
    'appointment_id', current_setting('glowbook.x3'),
    'payment_method', 'card',
    'item_charges', jsonb_build_array(jsonb_build_object(
      'id', (select id from appointment_items where appointment_id = current_setting('glowbook.x3')::uuid),
      'price', 25))))$q$,
  'completar: un servicio de precio variable acepta el nuevo precio'
);

-- T20: la cita de precio variable queda cobrada a 25
select ok(
  (select status = 'completed' and total_price = 25 from appointments where id = current_setting('glowbook.x3')::uuid),
  'completar precio variable: total cobrado 25'
);

-- T21: no_show cierra la cita y libera la agenda
select set_config('glowbook.noshow_x6', (select public.mark_no_show(jsonb_build_object(
  'appointment_id', current_setting('glowbook.x6')))::text), true);
select ok(
  (select status = 'no_show' from appointments where id = current_setting('glowbook.x6')::uuid)
  and (select count(*) = 0 from appointment_items where appointment_id = current_setting('glowbook.x6')::uuid and blocks_calendar),
  'no_show: estado no_show y items con blocks_calendar = false'
);

-- T22: completar con clave: la repeticion devuelve el mismo resultado sin reejecutar
select set_config('glowbook.c7', (select public.complete_appointment(jsonb_build_object(
  'appointment_id', current_setting('glowbook.x7'),
  'payment_method', 'cash',
  'idempotency_key', 'd1000000-0000-0000-0000-000000000005',
  'item_charges', jsonb_build_array(jsonb_build_object(
    'id', (select id from appointment_items where appointment_id = current_setting('glowbook.x7')::uuid),
    'price', 15, 'discount_percentage', 0))
)))::text, true);
select is(
  (select public.complete_appointment(jsonb_build_object(
    'appointment_id', current_setting('glowbook.x7'),
    'payment_method', 'cash',
    'idempotency_key', 'd1000000-0000-0000-0000-000000000005',
    'item_charges', jsonb_build_array(jsonb_build_object(
      'id', (select id from appointment_items where appointment_id = current_setting('glowbook.x7')::uuid),
      'price', 15, 'discount_percentage', 0))
  )))::text,
  current_setting('glowbook.c7'),
  'completar con clave: la repeticion devuelve el mismo resultado guardado'
);

-- T23: metodo de pago no habilitado para el salon es rechazado
select throws_ok(
  $q$select public.complete_appointment(jsonb_build_object(
    'appointment_id', current_setting('glowbook.x4'),
    'payment_method', 'bitcoin'))$q$,
  '22023',
  'Ese metodo de pago no esta habilitado para este salon.',
  'completar: un metodo de pago no habilitado para el salon es rechazado'
);

-- C2. Confirmacion con guarda de transicion y promocion de cliente temporal al completar

-- T45: confirmar una cita programada la pasa a confirmada (FOR UPDATE + guarda scheduled -> confirmed)
select set_config('glowbook.cf4', (select public.confirm_appointment(jsonb_build_object(
  'appointment_id', current_setting('glowbook.x4')))::text), true);

select ok(
  (select status = 'confirmed' from appointments where id = current_setting('glowbook.x4')::uuid),
  'confirmar: una cita programada pasa a confirmada'
);

-- T46: confirmar una cita ya confirmada es una transicion invalida
select throws_ok(
  $q$select public.confirm_appointment(jsonb_build_object('appointment_id', current_setting('glowbook.x4')))$q$,
  'P0001',
  'No se puede cambiar el estado de "confirmed" a "confirmed".',
  'confirmar: una cita ya confirmada no vuelve a confirmarse'
);

-- T47: una cita cancelada no puede confirmarse (no hay carrera cancelar/confirmar)
select throws_ok(
  $q$select public.confirm_appointment(jsonb_build_object('appointment_id', current_setting('glowbook.x5')))$q$,
  'P0001',
  'No se puede cambiar el estado de "cancelled" a "confirmed".',
  'confirmar: una cita cancelada no se puede confirmar'
);

-- Cliente temporal (como postgres): la cita x4 pasa a su cliente temporal antes de completarla
reset role;
insert into customers (id, salon_id, first_name, last_name, is_active, is_temporary) values
  ('c6500000-0000-0000-0000-000000000009', 'c6100000-0000-0000-0000-000000000001', 'Temporal', 'Cliente', false, true);
update appointments set customer_id = 'c6500000-0000-0000-0000-000000000009'
where id = current_setting('glowbook.x4')::uuid;
set local role authenticated;

-- T48: completar la cita con cliente temporal se acepta en una sola llamada
select lives_ok(
  $q$select public.complete_appointment(jsonb_build_object(
    'appointment_id', current_setting('glowbook.x4'),
    'payment_method', 'cash',
    'item_charges', jsonb_build_array(jsonb_build_object(
      'id', (select id from appointment_items where appointment_id = current_setting('glowbook.x4')::uuid),
      'price', 15, 'discount_percentage', 0))))$q$,
  'completar: cita de cliente temporal confirmada se completa'
);

-- T49: el cliente temporal se promueve (is_temporary = false, is_active = true) dentro de la misma transaccion
select ok(
  (select is_temporary = false and is_active = true
   from customers where id = 'c6500000-0000-0000-0000-000000000009'),
  'completar: el cliente temporal queda promovido a cliente activo'
);

-- D. Venta de vitrina con clave (1 venta, 1 movimiento, stock descontado una sola vez)

select set_config('glowbook.rs1', (select public.record_retail_sale(
  'c6100000-0000-0000-0000-000000000001', 'c6500000-0000-0000-0000-000000000001',
  'c6600000-0000-0000-0000-000000000001', 'retail', 2, 5, 'cash', 'Venta clave',
  'd1000000-0000-0000-0000-000000000011'))::text, true);

-- T24: primera venta con clave devuelve id
select isnt(current_setting('glowbook.rs1'), null, 'venta con clave: la primera llamada registra la venta');

-- T25: repetir con la misma clave y datos devuelve la misma venta
select is(
  (select public.record_retail_sale(
    'c6100000-0000-0000-0000-000000000001', 'c6500000-0000-0000-0000-000000000001',
    'c6600000-0000-0000-0000-000000000001', 'retail', 2, 5, 'cash', 'Venta clave',
    'd1000000-0000-0000-0000-000000000011'))::text,
  current_setting('glowbook.rs1'),
  'venta con clave: la repeticion devuelve el mismo sale_id'
);

-- T26: el stock se descuenta una sola vez (10 - 2 = 8)
select is(
  (select quantity from inventory_stock_locations
    where product_id = 'c6600000-0000-0000-0000-000000000001' and location = 'retail'),
  8::numeric,
  'venta con clave: el stock se descuenta una sola vez'
);

-- T27: una fila de venta y un movimiento de stock para esa venta
select ok(
  (select count(*) from retail_sales where note = 'Venta clave') = 1
  and (select count(*) from inventory_movements
        where reference_type = 'retail_sale' and reference_id = current_setting('glowbook.rs1')::uuid) = 1,
  'venta con clave: 1 fila de venta y 1 movimiento de stock'
);

-- T28: misma clave con otros datos => 22023
select throws_ok(
  $q$select public.record_retail_sale(
    'c6100000-0000-0000-0000-000000000001', 'c6500000-0000-0000-0000-000000000001',
    'c6600000-0000-0000-0000-000000000001', 'retail', 3, 5, 'cash', 'Venta clave',
    'd1000000-0000-0000-0000-000000000011')$q$,
  '22023',
  'Esta solicitud ya se usó con otros datos.',
  'venta con clave: misma clave con otra cantidad es rechazada'
);

-- T29: venta sin stock suficiente con clave => error de negocio
select throws_ok(
  $q$select public.record_retail_sale(
    'c6100000-0000-0000-0000-000000000001', 'c6500000-0000-0000-0000-000000000001',
    'c6600000-0000-0000-0000-000000000001', 'retail', 100, 5, 'cash', 'Venta sin stock',
    'd1000000-0000-0000-0000-000000000012')$q$,
  '22023',
  'Stock insuficiente para completar la venta.',
  'venta con clave: stock insuficiente se propaga como error de negocio'
);

-- T30: tras ese error no queda clave reservada
reset role;
select is(
  (select count(*)::int from idempotency_keys where idempotency_key = 'd1000000-0000-0000-0000-000000000012'),
  0,
  'venta con error: no queda clave reservada'
);
set local role authenticated;

-- T31: sin clave, dos ventas = dos filas (conducta anterior)
select set_config('glowbook.n0', (select count(*)::text from retail_sales where note = 'Venta sin clave'), true);
select public.record_retail_sale('c6100000-0000-0000-0000-000000000001', 'c6500000-0000-0000-0000-000000000001',
  'c6600000-0000-0000-0000-000000000001', 'retail', 1, 5, 'cash', 'Venta sin clave');
select public.record_retail_sale('c6100000-0000-0000-0000-000000000001', 'c6500000-0000-0000-0000-000000000001',
  'c6600000-0000-0000-0000-000000000001', 'retail', 1, 5, 'cash', 'Venta sin clave');
select is(
  (select count(*) from retail_sales where note = 'Venta sin clave') - current_setting('glowbook.n0')::bigint,
  2::bigint,
  'venta sin clave: cada llamada registra su venta (conducta anterior)'
);

-- T32: owner de otro salon no puede vender en el salon A (aislamiento)
select set_config('request.jwt.claims',
  '{"sub":"c6000000-0000-0000-0000-00000000000b","role":"authenticated","salon_id":"c6100000-0000-0000-0000-000000000002"}', true);
select throws_ok(
  $q$select public.record_retail_sale('c6100000-0000-0000-0000-000000000001', null,
    'c6600000-0000-0000-0000-000000000001', 'retail', 1, 5, 'cash', 'Cruzada', 'd1000000-0000-0000-0000-000000000013')$q$,
  '42501',
  'No tienes acceso a este salon.',
  'aislamiento: owner del salon B no puede vender en el salon A con clave'
);
select set_config('request.jwt.claims',
  '{"sub":"c6000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"c6100000-0000-0000-0000-000000000001"}', true);

-- E. Compra de inventario con clave

-- T33: primera compra con clave
select set_config('glowbook.pu1', (select public.record_inventory_purchase(
  'c6100000-0000-0000-0000-000000000001', 'Proveedor', '2030-01-05',
  'c6600000-0000-0000-0000-000000000001', 5, 4, 'Compra clave',
  'd1000000-0000-0000-0000-000000000014'))::text, true);
select isnt(current_setting('glowbook.pu1'), null, 'compra con clave: la primera llamada registra la compra');

-- T34: repetir con la misma clave devuelve la misma compra
select is(
  (select public.record_inventory_purchase(
    'c6100000-0000-0000-0000-000000000001', 'Proveedor', '2030-01-05',
    'c6600000-0000-0000-0000-000000000001', 5, 4, 'Compra clave',
    'd1000000-0000-0000-0000-000000000014'))::text,
  current_setting('glowbook.pu1'),
  'compra con clave: la repeticion devuelve el mismo purchase_id'
);

-- T35: stock de bodega sumado una sola vez (20 + 5 = 25) y una sola compra registrada
select ok(
  (select quantity from inventory_stock_locations
    where product_id = 'c6600000-0000-0000-0000-000000000001' and location = 'storage') = 25
  and (select count(*) from inventory_purchases where note = 'Compra clave') = 1,
  'compra con clave: stock de bodega sumado una sola vez y una sola compra'
);

-- F. Transferencia de inventario con clave

-- T36: transferencia con clave se aplica
select lives_ok(
  $q$select public.record_inventory_transfer('c6100000-0000-0000-0000-000000000001',
    'c6600000-0000-0000-0000-000000000001', 'storage', 'internal', 3, 'Reposicion',
    'd1000000-0000-0000-0000-000000000015')$q$,
  'transferencia con clave: la primera llamada se aplica'
);

-- T37: la repeticion no vuelve a mover stock
select lives_ok(
  $q$select public.record_inventory_transfer('c6100000-0000-0000-0000-000000000001',
    'c6600000-0000-0000-0000-000000000001', 'storage', 'internal', 3, 'Reposicion',
    'd1000000-0000-0000-0000-000000000015')$q$,
  'transferencia con clave: la repeticion no falla'
);

-- T38: bodega 25 - 3 = 22 e interno 0 + 3 = 3, una sola vez
select ok(
  (select quantity from inventory_stock_locations
    where product_id = 'c6600000-0000-0000-0000-000000000001' and location = 'storage') = 22
  and (select quantity from inventory_stock_locations
    where product_id = 'c6600000-0000-0000-0000-000000000001' and location = 'internal') = 3,
  'transferencia con clave: el stock se mueve una sola vez'
);

-- G. Registro de recordatorios: columna y unicidad parcial (como postgres)
reset role;

-- T39: dos envios con la misma clave en la misma sala => 23505
select throws_ok(
  $q$insert into appointment_reminder_log (salon_id, appointment_id, channel, idempotency_key)
     select 'c6100000-0000-0000-0000-000000000001'::uuid, a.id, 'whatsapp', 'd1000000-0000-0000-0000-000000000021'::uuid
     from appointments a where a.notes = 'X7'
     union all
     select 'c6100000-0000-0000-0000-000000000001'::uuid, a.id, 'whatsapp', 'd1000000-0000-0000-0000-000000000021'::uuid
     from appointments a where a.notes = 'X7'$q$,
  '23505',
  null,
  'recordatorios: la misma clave no registra dos envios en el mismo salon'
);

-- T40: los registros sin clave (duplicados historicos) siguen permitidos
select lives_ok(
  $q$insert into appointment_reminder_log (salon_id, appointment_id, channel)
     select 'c6100000-0000-0000-0000-000000000001'::uuid, a.id, 'whatsapp'
     from appointments a where a.notes = 'X7'
     union all
     select 'c6100000-0000-0000-0000-000000000001'::uuid, a.id, 'whatsapp'
     from appointments a where a.notes = 'X7'$q$,
  'recordatorios: los registros sin clave no se ven afectados por el indice parcial'
);

-- H. Limpieza de claves antiguas (> 7 dias) durante una llamada keyed

insert into idempotency_keys (user_id, procedure, idempotency_key, request_hash, result, created_at, completed_at) values
  ('c6000000-0000-0000-0000-00000000000a', 'record_retail_sale', 'd1000000-0000-0000-0000-000000000099', 'h',
   '{"sale_id":"00000000-0000-0000-0000-000000000000"}', now() - interval '8 days', now() - interval '8 days');

set local role authenticated;
select public.record_retail_sale('c6100000-0000-0000-0000-000000000001', null,
  'c6600000-0000-0000-0000-000000000001', 'retail', 1, 5, 'cash', 'Venta limpieza',
  'd1000000-0000-0000-0000-000000000016');

-- T41: la clave de mas de 7 dias se elimina en la limpieza acotada
reset role;
select is(
  (select count(*)::int from idempotency_keys where idempotency_key = 'd1000000-0000-0000-0000-000000000099'),
  0,
  'limpieza: las claves de mas de 7 dias se eliminan'
);

-- I. Superficie de seguridad de las funciones internas y la tabla

-- T42: los roles cliente no ejecutan las funciones internas de idempotencia
select ok(
  not has_function_privilege('authenticated', 'public.idempotency_begin(text,uuid,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.idempotency_finish(text,uuid,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.idempotency_begin(text,uuid,text)', 'EXECUTE'),
  'idempotency_begin / idempotency_finish no son ejecutables por roles cliente'
);

-- T43: la tabla tiene RLS y ningun privilegio para roles cliente
select ok(
  (select relrowsecurity from pg_class where oid = 'public.idempotency_keys'::regclass)
  and not has_table_privilege('authenticated', 'public.idempotency_keys', 'select')
  and not has_table_privilege('anon', 'public.idempotency_keys', 'select'),
  'idempotency_keys: RLS activo y sin privilegios para roles cliente'
);

-- T44: las RPC de cita nuevas son ejecutables por authenticated y no por anon
select ok(
  has_function_privilege('authenticated', 'public.complete_appointment(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.cancel_appointment(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.mark_no_show(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.confirm_appointment(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.confirm_appointment(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.cancel_appointment(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.complete_appointment(jsonb)', 'EXECUTE'),
  'transiciones de cita: authenticated las ejecuta y anon no'
);

select * from finish();
rollback;
