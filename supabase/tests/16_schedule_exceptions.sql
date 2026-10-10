-- Caracterizacion de trg_enforce_employee_schedule_exception (migracion 061).
-- Un colaborador con excepcion de horario (dia libre) en una fecha no puede tener items que bloquean
-- calendario que EMPIEZAN en esa fecha local. La fecha local usa la zona horaria del salon
-- (salons.timezone, por defecto America/Panama, UTC-5 sin horario de verano).
-- El trigger se dispara solo al insertar, o al actualizar salon_id, employee_id, start_time o blocks_calendar.
-- Un cambio de precio NO lo dispara: un item creado antes de la excepcion no se revalida.
begin;
select plan(13);

-- Fixtures (como postgres)
insert into salons (id, name) values
  ('ec000000-0000-0000-0000-000000000001', 'Salon Excepciones');

insert into employees (id, salon_id, first_name, last_name) values
  ('ed000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'Emp', 'Uno'),
  ('ed000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-000000000001', 'Emp', 'Dos'),
  ('ed000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000001', 'Emp', 'Tres');

insert into service_categories (id, salon_id, name) values
  ('ef000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'Cat Excep');

insert into services (id, salon_id, category_id, name, duration_minutes, price) values
  ('ee000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'ef000000-0000-0000-0000-000000000001', 'Serv Excep', 30, 15);

insert into customers (id, salon_id, first_name, last_name) values
  ('f0000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'Cli', 'Excep');

insert into appointments (id, salon_id, customer_id) values
  ('f1000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001');

-- Excepcion: el colaborador 1 tiene el dia libre el 7 de enero de 2030
insert into schedule_exceptions (salon_id, employee_id, exception_date, reason) values
  ('ec000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000001', '2030-01-07', 'Vacaciones');

-- Item de E3 ANTES de su excepcion (para el caso de "solo el precio no revalida")
insert into appointment_items (id, salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
values ('f2000000-0000-0000-0000-000000000005', 'ec000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
        'ee000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000003',
        '2030-02-10 20:00:00+00', '2030-02-10 20:30:00+00', 30, 15, 9);

-- 1. Control: la excepcion del colaborador 1 existe (si no, las pruebas serian vacuas)
select is(
  (select count(*) from schedule_exceptions where employee_id = 'ed000000-0000-0000-0000-000000000001'),
  1::bigint,
  'control: el colaborador 1 tiene la excepcion del 7 de enero sembrada'
);

-- 2. Un item que bloquea calendario y empieza el dia libre se rechaza
select throws_ok(
  $q$insert into appointment_items (salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
     values ('ec000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001',
             'ed000000-0000-0000-0000-000000000001', '2030-01-07 20:00:00+00', '2030-01-07 20:30:00+00', 30, 15, 0)$q$,
  'P0001',
  'El profesional tiene el día libre en esa fecha',
  'no se puede agendar un item bloqueante en el dia libre del colaborador'
);

-- 3. Zona horaria: 03:00 UTC del 7 es el 6 de enero 22:00 en Panama, asi que NO es dia libre
select lives_ok(
  $q$insert into appointment_items (id, salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
     values ('f2000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
             'ee000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000001', '2030-01-07 03:00:00+00', '2030-01-07 03:30:00+00', 30, 15, 0)$q$,
  'la fecha se calcula en la zona del salon: 03:00 UTC del 7 (6 de enero en Panama) no es dia libre'
);

-- 4. La excepcion es por colaborador: el colaborador 2 trabaja ese mismo dia
select lives_ok(
  $q$insert into appointment_items (id, salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
     values ('f2000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
             'ee000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000002', '2030-01-07 20:00:00+00', '2030-01-07 20:30:00+00', 30, 15, 1)$q$,
  'la excepcion afecta solo al colaborador que la tiene; otro colaborador puede agendar ese dia'
);

-- 5. El colaborador 1 si puede trabajar otro dia
select lives_ok(
  $q$insert into appointment_items (id, salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
     values ('f2000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
             'ee000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000001', '2030-01-08 20:00:00+00', '2030-01-08 20:30:00+00', 30, 15, 2)$q$,
  'el colaborador con excepcion puede agendar en cualquier otro dia'
);

-- 6. Un item que NO bloquea calendario (cancelado) puede existir en el dia libre
select lives_ok(
  $q$insert into appointment_items (id, salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering, blocks_calendar)
     values ('f2000000-0000-0000-0000-000000000004', 'ec000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
             'ee000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000001', '2030-01-07 22:00:00+00', '2030-01-07 22:30:00+00', 30, 15, 3, false)$q$,
  'un item con blocks_calendar = false se permite aunque caiga en el dia libre'
);

-- 7. Reasignar un item a un colaborador con dia libre en esa fecha tambien se rechaza (employee_id)
select throws_ok(
  $q$update appointment_items set employee_id = 'ed000000-0000-0000-0000-000000000001'
      where id = 'f2000000-0000-0000-0000-000000000002'$q$,
  'P0001',
  'El profesional tiene el día libre en esa fecha',
  'reasignar un item bloqueante al colaborador con dia libre se rechaza (update de employee_id)'
);

-- 8. Activar blocks_calendar sobre un item no bloqueante en el dia libre se rechaza
select throws_ok(
  $q$update appointment_items set blocks_calendar = true where id = 'f2000000-0000-0000-0000-000000000004'$q$,
  'P0001',
  'El profesional tiene el día libre en esa fecha',
  'volver a bloqueante un item en el dia libre se rechaza (update de blocks_calendar)'
);

-- 9. Mover un item existente al dia libre se rechaza (update de start_time)
select throws_ok(
  $q$update appointment_items set start_time = '2030-01-07 20:00:00+00', end_time = '2030-01-07 20:30:00+00'
      where id = 'f2000000-0000-0000-0000-000000000001'$q$,
  'P0001',
  'El profesional tiene el día libre en esa fecha',
  'mover un item bloqueante al dia libre se rechaza (update de start_time)'
);

-- 10. Excepcion creada DESPUES de un item: solo cambiar el precio no lo revalida (el trigger no se dispara)
insert into schedule_exceptions (salon_id, employee_id, exception_date, reason) values
  ('ec000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000003', '2030-02-10', 'Formacion');

select lives_ok(
  $q$update appointment_items set price = 99 where id = 'f2000000-0000-0000-0000-000000000005'$q$,
  'cambiar solo el precio de un item previo a la excepcion no dispara la validacion (columnas del trigger)'
);

-- 11. Pero un item nuevo de ese colaborador en la fecha ya excepcionada se rechaza
select throws_ok(
  $q$insert into appointment_items (salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
     values ('ec000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001',
             'ed000000-0000-0000-0000-000000000003', '2030-02-10 21:00:00+00', '2030-02-10 21:30:00+00', 30, 15, 10)$q$,
  'P0001',
  'El profesional tiene el día libre en esa fecha',
  'un item nuevo del colaborador en la fecha de la excepcion se rechaza'
);

-- 12. La funcion no es ejecutable por clientes (solo la usa el trigger)
select ok(
  not has_function_privilege('authenticated', 'public.enforce_employee_schedule_exception()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.enforce_employee_schedule_exception()', 'EXECUTE'),
  'enforce_employee_schedule_exception no es ejecutable por authenticated ni por anon'
);

-- 13. La zona horaria la fija el salon: en Europe/Madrid, 01:00 UTC del 7 ya es el 7 de enero
update salons set timezone = 'Europe/Madrid' where id = 'ec000000-0000-0000-0000-000000000001';

select throws_ok(
  $q$insert into appointment_items (salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
     values ('ec000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001',
             'ed000000-0000-0000-0000-000000000001', '2030-01-07 01:00:00+00', '2030-01-07 01:30:00+00', 30, 15, 11)$q$,
  'P0001',
  'El profesional tiene el día libre en esa fecha',
  'la fecha local usa la zona horaria del salon: en Europe/Madrid 01:00 UTC del 7 cae en dia libre'
);

select * from finish();
rollback;
