-- Caracterizacion del trigger trg_recalc_appt -> recalc_appointment() (ultima version: migracion 033).
-- Tras cada insert, update o delete de appointment_items recalcula la cabecera:
--   start_time = min(start_time), end_time = max(end_time),
--   discount_amount = sum(discount_amount), total_price = greatest(sum(price) - sum(discount_amount), 0).
-- Sin items, start_time y end_time quedan a null y el total a 0.
-- DECISION DOCUMENTADA: la funcion NO filtra por blocks_calendar. Un item cancelado (blocks_calendar = false,
-- que es lo que pone la cancelacion) sigue sumando al total y a start/end. Los tests 12 y 13 lo fijan a proposito.
begin;
select plan(14);

-- Fixtures (como postgres)
insert into salons (id, name) values
  ('e4000000-0000-0000-0000-000000000001', 'Salon Recalc');

insert into employees (id, salon_id, first_name, last_name) values
  ('e5000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000001', 'Emp', 'Uno'),
  ('e5000000-0000-0000-0000-000000000002', 'e4000000-0000-0000-0000-000000000001', 'Emp', 'Dos');

insert into service_categories (id, salon_id, name) values
  ('e7000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000001', 'Cat Recalc');

insert into services (id, salon_id, category_id, name, duration_minutes, price) values
  ('e6000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001', 'Serv Recalc', 30, 15);

insert into customers (id, salon_id, first_name, last_name) values
  ('e8000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000001', 'Cli', 'Recalc');

insert into appointments (id, salon_id, customer_id) values
  ('e9000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001'),
  ('e9000000-0000-0000-0000-000000000002', 'e4000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001');

-- 1. Cabecera recien creada, sin items
select ok(
  (select start_time is null and end_time is null and total_price = 0
     from appointments where id = 'e9000000-0000-0000-0000-000000000001'),
  'sin items, la cabecera tiene start_time y end_time a null y total 0'
);

-- 2. Un item: la cabecera toma su total
insert into appointment_items (id, salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
values ('ea000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001',
        'e6000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001',
        '2030-01-07 20:00:00+00', '2030-01-07 20:30:00+00', 30, 15, 0);

select is(
  (select total_price from appointments where id = 'e9000000-0000-0000-0000-000000000001'),
  15::numeric,
  'al insertar un item, el total de la cabecera es el precio del item'
);

-- 3. Segundo item de otro profesional, mas tarde: start = minimo, end = maximo, total = suma
insert into appointment_items (id, salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
values ('ea000000-0000-0000-0000-000000000002', 'e4000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001',
        'e6000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000002',
        '2030-01-07 21:00:00+00', '2030-01-07 21:45:00+00', 45, 25, 1);

select results_eq(
  $q$select start_time, end_time, total_price from appointments where id = 'e9000000-0000-0000-0000-000000000001'$q$,
  $q$select '2030-01-07 20:00:00+00'::timestamptz, '2030-01-07 21:45:00+00'::timestamptz, 40::numeric$q$,
  'start_time es el minimo, end_time el maximo y total_price la suma de precios'
);

-- 4. Descuento por item: la cabecera suma los descuentos y resta del total
update appointment_items set discount_amount = 10 where id = 'ea000000-0000-0000-0000-000000000002';

select results_eq(
  $q$select discount_amount, total_price from appointments where id = 'e9000000-0000-0000-0000-000000000001'$q$,
  $q$select 10::numeric, 30::numeric$q$,
  'un descuento de item baja el total y se refleja en discount_amount de la cabecera'
);

-- 5. Un descuento mayor que el precio del item se rechaza por CHECK (migracion 034):
--    por eso sum(discount) nunca supera sum(price) y el greatest(..., 0) de la funcion es defensivo.
select throws_ok(
  $q$update appointment_items set discount_amount = 100 where id = 'ea000000-0000-0000-0000-000000000001'$q$,
  '23514',
  null,
  'un descuento mayor que el precio del item se rechaza (CHECK discount_not_greater_than_price)'
);

-- 6. El intento rechazado no altera la cabecera: sigue en 30 (15 + 25 - 10)
select is(
  (select total_price from appointments where id = 'e9000000-0000-0000-0000-000000000001'),
  30::numeric,
  'tras el descuento rechazado la cabecera conserva el total anterior'
);

-- 7. Cambiar el precio de un item recalcula
update appointment_items set price = 20 where id = 'ea000000-0000-0000-0000-000000000001';

select is(
  (select total_price from appointments where id = 'e9000000-0000-0000-0000-000000000001'),
  35::numeric,
  'al cambiar el precio de un item, el total de la cabecera se recalcula (20 + 25 - 10)'
);

-- 8. Mover la hora de un item recalcula end_time
update appointment_items
   set start_time = '2030-01-07 22:00:00+00', end_time = '2030-01-07 22:45:00+00'
 where id = 'ea000000-0000-0000-0000-000000000002';

select is(
  (select end_time from appointments where id = 'e9000000-0000-0000-0000-000000000001'),
  '2030-01-07 22:45:00+00'::timestamptz,
  'al mover un item, end_time de la cabecera pasa a ser el maximo nuevo'
);

-- 9. Borrar un item que no es el ultimo: la cabecera baja a los items que quedan
delete from appointment_items where id = 'ea000000-0000-0000-0000-000000000002';

select results_eq(
  $q$select start_time, end_time, total_price, discount_amount from appointments where id = 'e9000000-0000-0000-0000-000000000001'$q$,
  $q$select '2030-01-07 20:00:00+00'::timestamptz, '2030-01-07 20:30:00+00'::timestamptz, 20::numeric, 0::numeric$q$,
  'al borrar un item la cabecera se recalcula con los items que quedan (start, end, total y descuento)'
);

-- 10. Borrar el ultimo item no falla (new es null en DELETE) y deja la cabecera vacia
select lives_ok(
  $q$delete from appointment_items where id = 'ea000000-0000-0000-0000-000000000001'$q$,
  'borrar el ultimo item de una cita no lanza error'
);

select ok(
  (select start_time is null and end_time is null and total_price = 0 and discount_amount = 0
     from appointments where id = 'e9000000-0000-0000-0000-000000000001'),
  'sin items tras borrar el ultimo, start_time y end_time vuelven a null y el total a 0'
);

-- 11. Dos items de nuevo; el tercero se inserta bloqueando calendario
insert into appointment_items (id, salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
values ('ea000000-0000-0000-0000-000000000004', 'e4000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001',
        'e6000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001',
        '2030-01-07 20:00:00+00', '2030-01-07 20:30:00+00', 30, 20, 0);
insert into appointment_items (id, salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
values ('ea000000-0000-0000-0000-000000000003', 'e4000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001',
        'e6000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000002',
        '2030-01-07 21:00:00+00', '2030-01-07 21:45:00+00', 45, 25, 2);

select is(
  (select total_price from appointments where id = 'e9000000-0000-0000-0000-000000000001'),
  45::numeric,
  'dos items bloqueando calendario suman 20 + 25 = 45'
);

-- 12. CANCELADOS: marcar un item como no bloqueante (lo que hace la cancelacion) NO cambia el total
update appointment_items set blocks_calendar = false where id = 'ea000000-0000-0000-0000-000000000003';

select is(
  (select total_price from appointments where id = 'e9000000-0000-0000-0000-000000000001'),
  45::numeric,
  'un item con blocks_calendar = false sigue sumando al total (la funcion no filtra por bloqueo)'
);

-- 13. Aislamiento: recalcular X no toca la cabecera de otra cita Y
insert into appointment_items (id, salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
values ('ea000000-0000-0000-0000-000000000005', 'e4000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000002',
        'e6000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001',
        '2030-01-08 10:00:00+00', '2030-01-08 10:30:00+00', 30, 99, 0);

update appointment_items set price = 30 where id = 'ea000000-0000-0000-0000-000000000004';

select is(
  (select total_price from appointments where id = 'e9000000-0000-0000-0000-000000000002'),
  99::numeric,
  'recalcular la cita X no modifica el total de la cita Y'
);

select * from finish();
rollback;
