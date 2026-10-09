-- Read-models SQL (migracion 20240101000066): agregados del dashboard y de los reportes.
-- Cubre: totales exactos con mas de 1000 filas por tabla (sin truncado de max_rows), aislamiento entre
-- salones, bordes (sin datos, cambios de mes, zona horaria y cambio de horario), modulos desactivados,
-- grants (solo authenticated), search_path fijo, SECURITY INVOKER e indices.
--
-- Datos de salon A (America/Panama, UTC-5 sin horario de verano), anio 2030:
--   * 1200 citas completadas (10,00 cada una; empleados Ana Zeta 10 % y Bea Alfa 15 %) + 60 no completadas.
--   * 1100 ventas de vitrina (3,00 cada una); 300 con items (Shampoo impar, Acondicionador par, qty 2).
--   * 1100 gastos (0,10 cada uno; 550 "Luz" y 550 "rent"); 5 compras de inventario (100,10 cada una).
-- Fecha de referencia del dashboard: 2030-06-15 12:00 Panama = 2030-06-15 17:00Z.
begin;
select plan(79);

-- Fixtures (como postgres, saltando RLS)
insert into auth.users (id, email, aud, role) values
  ('e6000000-0000-0000-0000-00000000000a', 'owner.a@glowbook.test', 'authenticated', 'authenticated'),
  ('e6000000-0000-0000-0000-00000000000b', 'owner.b@glowbook.test', 'authenticated', 'authenticated'),
  ('e6000000-0000-0000-0000-00000000000c', 'owner.c@glowbook.test', 'authenticated', 'authenticated'),
  ('e6000000-0000-0000-0000-00000000000d', 'owner.d@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name, timezone) values
  ('e5000000-0000-0000-0000-00000000000a', 'Salon A', 'America/Panama'),
  ('e5000000-0000-0000-0000-00000000000b', 'Salon B', 'America/Panama'),
  ('e5000000-0000-0000-0000-00000000000c', 'Salon C', 'America/Panama'),
  ('e5000000-0000-0000-0000-00000000000d', 'Salon D', 'America/Panama');

insert into profiles (id, salon_id, is_owner, full_name) values
  ('e6000000-0000-0000-0000-00000000000a', 'e5000000-0000-0000-0000-00000000000a', true, 'Owner A'),
  ('e6000000-0000-0000-0000-00000000000b', 'e5000000-0000-0000-0000-00000000000b', true, 'Owner B'),
  ('e6000000-0000-0000-0000-00000000000c', 'e5000000-0000-0000-0000-00000000000c', true, 'Owner C'),
  ('e6000000-0000-0000-0000-00000000000d', 'e5000000-0000-0000-0000-00000000000d', true, 'Owner D');

insert into service_categories (id, salon_id, name) values
  ('e7000000-0000-0000-0000-0000000000a1', 'e5000000-0000-0000-0000-00000000000a', 'Cortes A'),
  ('e7000000-0000-0000-0000-0000000000b1', 'e5000000-0000-0000-0000-00000000000b', 'Cortes B'),
  ('e7000000-0000-0000-0000-0000000000d1', 'e5000000-0000-0000-0000-00000000000d', 'Cortes D');

insert into services (id, salon_id, category_id, name, duration_minutes, price) values
  ('e8000000-0000-0000-0000-0000000000a1', 'e5000000-0000-0000-0000-00000000000a', 'e7000000-0000-0000-0000-0000000000a1', 'Corte', 30, 10),
  ('e8000000-0000-0000-0000-0000000000a2', 'e5000000-0000-0000-0000-00000000000a', 'e7000000-0000-0000-0000-0000000000a1', 'Tinte', 30, 20),
  ('e8000000-0000-0000-0000-0000000000b1', 'e5000000-0000-0000-0000-00000000000b', 'e7000000-0000-0000-0000-0000000000b1', 'Servicio B', 30, 100),
  ('e8000000-0000-0000-0000-0000000000d1', 'e5000000-0000-0000-0000-00000000000d', 'e7000000-0000-0000-0000-0000000000d1', 'Servicio D', 30, 50);

insert into employees (id, salon_id, first_name, last_name, commission_percentage) values
  ('e9000000-0000-0000-0000-0000000000a1', 'e5000000-0000-0000-0000-00000000000a', 'Ana', 'Zeta', 10),
  ('e9000000-0000-0000-0000-0000000000a2', 'e5000000-0000-0000-0000-00000000000a', 'Bea', 'Alfa', 15),
  ('e9000000-0000-0000-0000-0000000000b1', 'e5000000-0000-0000-0000-00000000000b', 'Carla', 'Bravo', 20),
  ('e9000000-0000-0000-0000-0000000000d1', 'e5000000-0000-0000-0000-00000000000d', 'Dani', 'Dos', 0);

insert into customers (id, salon_id, first_name, last_name, is_active, is_temporary, created_at) values
  ('ea000000-0000-0000-0000-0000000000a1', 'e5000000-0000-0000-0000-00000000000a', 'Cli', 'Activa', true, false, '2030-02-10 12:00:00+00'),
  ('ea000000-0000-0000-0000-0000000000a2', 'e5000000-0000-0000-0000-00000000000a', 'Cli', 'Inactiva', false, false, '2030-02-11 12:00:00+00'),
  ('ea000000-0000-0000-0000-0000000000a3', 'e5000000-0000-0000-0000-00000000000a', 'Cli', 'Temporal', true, true, '2030-02-12 12:00:00+00'),
  ('ea000000-0000-0000-0000-0000000000b1', 'e5000000-0000-0000-0000-00000000000b', 'Cli', 'B', true, false, '2030-03-01 12:00:00+00'),
  ('ea000000-0000-0000-0000-0000000000d1', 'e5000000-0000-0000-0000-00000000000d', 'Cli', 'D', true, false, '2030-03-01 12:00:00+00');

insert into inventory_products (id, salon_id, name, is_active, deleted_at) values
  ('e4000000-0000-0000-0000-0000000000a1', 'e5000000-0000-0000-0000-00000000000a', 'Shampoo', true, null),
  ('e4000000-0000-0000-0000-0000000000a2', 'e5000000-0000-0000-0000-00000000000a', 'Acondicionador', true, null),
  ('e4000000-0000-0000-0000-0000000000a3', 'e5000000-0000-0000-0000-00000000000a', 'Agotado', true, null),
  ('e4000000-0000-0000-0000-0000000000a4', 'e5000000-0000-0000-0000-00000000000a', 'Bajo', true, null),
  ('e4000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-00000000000a', 'Borrado', true, '2030-01-05 00:00:00+00'),
  ('e4000000-0000-0000-0000-0000000000a6', 'e5000000-0000-0000-0000-00000000000a', 'Inactivo', false, null);

insert into inventory_stock_locations (salon_id, product_id, location, quantity, minimum_quantity) values
  ('e5000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-0000000000a1', 'retail', 50, 10),
  ('e5000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-0000000000a2', 'internal', 0, 0),
  ('e5000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-0000000000a4', 'retail', 2, 5),
  ('e5000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-0000000000a5', 'retail', 0, 0),
  ('e5000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-0000000000a6', 'storage', 0, 0);

-- 1200 citas completadas + 60 no completadas (no_show / cancelled / scheduled), inicio cada 6 h desde 2030-01-01 10:00 Panama.
insert into appointments (id, salon_id, customer_id, status)
select ('e0000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'e5000000-0000-0000-0000-00000000000a',
       'ea000000-0000-0000-0000-0000000000a1',
       case when g <= 1200 then 'completed'
            when g % 3 = 0 then 'no_show'
            when g % 3 = 1 then 'cancelled'
            else 'scheduled' end
from generate_series(1, 1260) g;

insert into appointment_items (salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, discount_amount, ordering, blocks_calendar)
select 'e5000000-0000-0000-0000-00000000000a',
       ('e0000000-0000-0000-0000-' || lpad(s.g::text, 12, '0'))::uuid,
       'e8000000-0000-0000-0000-0000000000a1',
       case when s.g % 2 = 1 then 'e9000000-0000-0000-0000-0000000000a1'::uuid else 'e9000000-0000-0000-0000-0000000000a2'::uuid end,
       s.start_at,
       s.start_at + interval '30 minutes',
       30, 10, 0, 0,
       s.g <= 1200
from (
  select g, '2030-01-01 10:00:00-05'::timestamptz + g * interval '6 hours' as start_at
  from generate_series(1, 1260) g
) s;

insert into appointments (id, salon_id, customer_id, status)
values
  ('e2000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-00000000000b', 'ea000000-0000-0000-0000-0000000000b1', 'completed'),
  ('e2000000-0000-0000-0000-000000000002', 'e5000000-0000-0000-0000-00000000000b', 'ea000000-0000-0000-0000-0000000000b1', 'completed'),
  ('e2000000-0000-0000-0000-000000000003', 'e5000000-0000-0000-0000-00000000000b', 'ea000000-0000-0000-0000-0000000000b1', 'completed');

insert into appointment_items (salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
values
  ('e5000000-0000-0000-0000-00000000000b', 'e2000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-0000000000b1', 'e9000000-0000-0000-0000-0000000000b1', '2030-06-10 15:00:00+00', '2030-06-10 15:30:00+00', 30, 100, 0),
  ('e5000000-0000-0000-0000-00000000000b', 'e2000000-0000-0000-0000-000000000002', 'e8000000-0000-0000-0000-0000000000b1', 'e9000000-0000-0000-0000-0000000000b1', '2030-06-11 15:00:00+00', '2030-06-11 15:30:00+00', 30, 100, 0),
  ('e5000000-0000-0000-0000-00000000000b', 'e2000000-0000-0000-0000-000000000003', 'e8000000-0000-0000-0000-0000000000b1', 'e9000000-0000-0000-0000-0000000000b1', '2030-06-12 15:00:00+00', '2030-06-12 15:30:00+00', 30, 100, 0);

-- Salon D: citas en el borde de medianoche local (2030-05-31 23:30 y 2030-06-01 00:00 Panama).
insert into appointments (id, salon_id, customer_id, status) values
  ('e3000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-00000000000d', 'ea000000-0000-0000-0000-0000000000d1', 'completed'),
  ('e3000000-0000-0000-0000-000000000002', 'e5000000-0000-0000-0000-00000000000d', 'ea000000-0000-0000-0000-0000000000d1', 'completed');

insert into appointment_items (salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
values
  ('e5000000-0000-0000-0000-00000000000d', 'e3000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-0000000000d1', 'e9000000-0000-0000-0000-0000000000d1', '2030-06-01 04:30:00+00', '2030-06-01 05:00:00+00', 30, 50, 0),
  ('e5000000-0000-0000-0000-00000000000d', 'e3000000-0000-0000-0000-000000000002', 'e8000000-0000-0000-0000-0000000000d1', 'e9000000-0000-0000-0000-0000000000d1', '2030-06-01 05:00:00+00', '2030-06-01 05:30:00+00', 30, 70, 0);

-- Ventas de vitrina: 1100 ventas de 3,00 cada 6 h desde 2030-01-01 12:00 Panama.
insert into retail_sales (id, salon_id, sale_date, payment_method, total_amount)
select ('e1000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'e5000000-0000-0000-0000-00000000000a',
       '2030-01-01 12:00:00-05'::timestamptz + g * interval '6 hours',
       'cash', 3
from generate_series(1, 1100) g;

-- Items de vitrina de las 300 primeras ventas: impares = Shampoo x1, pares = Acondicionador x2.
insert into retail_sale_items (salon_id, sale_id, product_id, location, quantity, unit_price, total_price, created_at)
select 'e5000000-0000-0000-0000-00000000000a',
       ('e1000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       case when g % 2 = 1 then 'e4000000-0000-0000-0000-0000000000a1'::uuid else 'e4000000-0000-0000-0000-0000000000a2'::uuid end,
       'retail',
       case when g % 2 = 1 then 1 else 2 end,
       1,
       case when g % 2 = 1 then 1 else 2 end,
       '2030-01-01 12:00:00-05'::timestamptz + g * interval '6 hours'
from generate_series(1, 300) g;

-- Gastos: 1100 de 0,10 repartidos en 2030; pares = "Luz" (utilities), impares = rent sin concepto.
insert into expenses (salon_id, expense_date, category, amount, concept)
select 'e5000000-0000-0000-0000-00000000000a',
       date '2030-01-01' + (g % 365),
       case when g % 2 = 0 then 'utilities' else 'rent' end,
       0.10,
       case when g % 2 = 0 then 'Luz' else null end
from generate_series(1, 1100) g;

-- Compras de inventario: 5 de 100,10 (la del 16 de junio queda fuera del acumulado a la fecha de referencia).
insert into inventory_purchases (salon_id, purchase_date, total_cost) values
  ('e5000000-0000-0000-0000-00000000000a', '2030-01-31', 100.10),
  ('e5000000-0000-0000-0000-00000000000a', '2030-02-01', 100.10),
  ('e5000000-0000-0000-0000-00000000000a', '2030-06-01', 100.10),
  ('e5000000-0000-0000-0000-00000000000a', '2030-06-15', 100.10),
  ('e5000000-0000-0000-0000-00000000000a', '2030-06-16', 100.10);

-- Valores esperados calculados con SQL directo sobre las tablas (como postgres, sin funciones de lectura).
select set_config('rm.e_june_completed', (select count(*) from appointments a
  where a.salon_id = 'e5000000-0000-0000-0000-00000000000a' and a.status = 'completed'
    and a.start_time >= '2030-06-01 05:00:00+00')::text, true);
select set_config('rm.e_june_revenue', (select coalesce(sum(a.total_price), 0) from appointments a
  where a.salon_id = 'e5000000-0000-0000-0000-00000000000a' and a.status = 'completed'
    and a.start_time >= '2030-06-01 05:00:00+00')::text, true);
select set_config('rm.e_today_appointments', (select count(*) from appointments a
  where a.salon_id = 'e5000000-0000-0000-0000-00000000000a'
    and a.start_time >= '2030-06-15 05:00:00+00' and a.start_time <= '2030-06-16 04:59:59.999+00')::text, true);
select set_config('rm.e_june_retail', (select coalesce(sum(r.total_amount), 0) from retail_sales r
  where r.salon_id = 'e5000000-0000-0000-0000-00000000000a'
    and r.sale_date >= '2030-06-01 05:00:00+00' and r.sale_date <= '2030-06-15 17:00:00+00')::text, true);
select set_config('rm.e_june_manual', (select coalesce(sum(e.amount), 0) from expenses e
  where e.salon_id = 'e5000000-0000-0000-0000-00000000000a'
    and e.expense_date between '2030-06-01' and '2030-06-15')::text, true);
select set_config('rm.e_june_purchases', (select coalesce(sum(p.total_cost), 0) from inventory_purchases p
  where p.salon_id = 'e5000000-0000-0000-0000-00000000000a'
    and p.purchase_date between '2030-06-01' and '2030-06-15')::text, true);
select set_config('rm.e_series_completed', (select count(*) from appointments a
  where a.salon_id = 'e5000000-0000-0000-0000-00000000000a' and a.status = 'completed'
    and a.start_time >= '2029-07-01 05:00:00+00' and a.start_time < '2030-07-01 05:00:00+00')::text, true);
select set_config('rm.e_top_items_june', (select count(*) from appointment_items i
  join appointments a on a.id = i.appointment_id
  where i.salon_id = 'e5000000-0000-0000-0000-00000000000a'
    and i.start_time >= '2030-06-01 05:00:00+00'
    and a.status not in ('cancelled', 'no_show'))::text, true);
select set_config('rm.e_busy_hours_total', (select count(*) from appointments a
  where a.salon_id = 'e5000000-0000-0000-0000-00000000000a'
    and a.status not in ('cancelled', 'no_show')
    and a.start_time >= '2030-01-01 05:00:00+00' and a.start_time <= '2031-01-01 04:59:59.999+00')::text, true);
select set_config('rm.e_e1_june_revenue', (select coalesce(sum(i.price - i.discount_amount), 0) from appointment_items i
  join appointments a on a.id = i.appointment_id
  where i.salon_id = 'e5000000-0000-0000-0000-00000000000a'
    and a.status = 'completed'
    and i.employee_id = 'e9000000-0000-0000-0000-0000000000a1'
    and i.start_time >= '2030-06-01 05:00:00+00' and i.start_time <= '2030-07-01 04:59:59.999+00')::text, true);

-- Sesion de owner A (authenticated), como en produccion.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e6000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"e5000000-0000-0000-0000-00000000000a"}', true);

-- A. Calendario (helpers). Como postgres se ejecutan igual; aqui basta el rol authenticated.
-- T01: inicio de dia en Panama (UTC-5)
select is(public.report_day_start('2030-01-01', 'America/Panama'), '2030-01-01 05:00:00+00'::timestamptz, 'day_start: medianoche de Panama en UTC');
-- T02: fin de dia en Panama = medianoche del dia siguiente menos 1 ms
select is(public.report_day_end('2030-01-01', 'America/Panama'), '2030-01-02 04:59:59.999+00'::timestamptz, 'day_end: medianoche siguiente menos 1 ms');
-- T03: inicio tras el cambio de horario en Nueva York (EDT, UTC-4)
select is(public.report_day_start('2030-03-11', 'America/New_York'), '2030-03-11 04:00:00+00'::timestamptz, 'day_start: dia tras cambio de horario (EDT)');
-- T04: dia de cambio de horario (24 h - 1 h): el fin cae a medianoche EDT del dia siguiente
select is(public.report_day_end('2030-03-10', 'America/New_York'), '2030-03-11 03:59:59.999+00'::timestamptz, 'day_end: dia de cambio de horario no se alarga');

-- B. Dashboard (owner A, fecha de referencia 2030-06-15 17:00Z)
-- T05: citas completadas del mes (sin limite superior, como el JS)
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'completedThisMonth')::numeric,
  current_setting('rm.e_june_completed')::numeric, 'dashboard: completadas del mes exactas con >1000 filas');
-- T06: ingresos de citas del mes
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'appointmentRevenue')::numeric,
  current_setting('rm.e_june_revenue')::numeric, 'dashboard: ingresos de citas del mes');
-- T07: citas de hoy, de cualquier estado
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'todayAppointments')::numeric,
  current_setting('rm.e_today_appointments')::numeric, 'dashboard: citas de hoy (cualquier estado)');
-- T08: ventas de vitrina del mes hasta ahora
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'retailRevenue')::numeric,
  current_setting('rm.e_june_retail')::numeric, 'dashboard: vitrina del mes hasta el instante de referencia');
-- T09: gastos manuales del mes hasta hoy
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'manualExpenses')::numeric,
  current_setting('rm.e_june_manual')::numeric, 'dashboard: gastos manuales del mes hasta hoy');
-- T10: compras de inventario: la del 16 de junio queda fuera
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'inventoryPurchases')::numeric,
  current_setting('rm.e_june_purchases')::numeric, 'dashboard: compras del mes excluyen fechas futuras');
-- T11: ganancia = ingresos (citas + vitrina) - gastos (manuales + compras)
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'estimatedProfit')::numeric,
  (public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'monthRevenue')::numeric
  - (public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'monthExpenses')::numeric,
  'dashboard: ganancia = ingresos - gastos');
-- T12: productos bajo stock (distintos): P2 (interno 0), P4 (2 <= 5), P6 (inactivo con 0); P5 borrado excluido
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'lowStockProducts')::int, 3,
  'dashboard: productos bajo stock excluyen borrados');
-- T13: clientes activos (incluye temporal activo, como el JS)
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'totalCustomers')::int, 2,
  'dashboard: clientes activos sin contar inactivos');
-- T14: serie de 12 meses terminando en el mes actual
select is((public.report_dashboard_monthly_appointments('America/Panama', '2030-06-15 17:00:00+00')->0->>'monthKey'), '2029-07',
  'dashboard serie: primer mes = 12 meses atras');
-- T15: el ultimo mes es el actual y la serie son 12 entradas
select is((public.report_dashboard_monthly_appointments('America/Panama', '2030-06-15 17:00:00+00')->11->>'monthKey'), '2030-06',
  'dashboard serie: ultimo mes = mes actual');
-- T16: suma de la serie = citas completadas en la ventana (sin meses fuera de la serie)
select is((select sum((e->>'total')::numeric) from jsonb_array_elements(public.report_dashboard_monthly_appointments('America/Panama', '2030-06-15 17:00:00+00')) e),
  current_setting('rm.e_series_completed')::numeric, 'dashboard serie: total de 12 meses exacto');
-- T17: tendencia del ultimo mes = junio - mayo
select is((public.report_dashboard_monthly_appointments('America/Panama', '2030-06-15 17:00:00+00')->11->>'delta')::int,
  (public.report_dashboard_monthly_appointments('America/Panama', '2030-06-15 17:00:00+00')->11->>'total')::int
  - (public.report_dashboard_monthly_appointments('America/Panama', '2030-06-15 17:00:00+00')->10->>'total')::int,
  'dashboard serie: delta = mes actual - mes anterior');
-- T18: servicios top del mes: items de citas no canceladas ni no_show (incluye agendadas)
select is((public.report_dashboard_top_services('America/Panama', '2030-06-15 17:00:00+00')->0->>'count')::int,
  current_setting('rm.e_top_items_june')::int, 'dashboard top servicios: cuenta items del mes');
-- T19: el primer servicio tiene 100 % (relativo al maximo)
select is((public.report_dashboard_top_services('America/Panama', '2030-06-15 17:00:00+00')->0->>'pct')::float8, 100::float8,
  'dashboard top servicios: pct relativo al maximo');

-- C. Totales del periodo (anio 2030, mas de 1000 filas por tabla)
-- T20: citas completadas del anio (1200 > 1000)
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'completedCount')::int, 1200,
  'periodo: completadas exactas sin truncado de max_rows');
-- T21: ingresos de citas
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'revenue')::numeric, 12000::numeric,
  'periodo: ingresos de citas del anio');
-- T22: vitrina del anio (1100 ventas)
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'retailRevenue')::numeric, 3300::numeric,
  'periodo: vitrina del anio (1100 filas)');
-- T23: gastos manuales exactos (1100 x 0,10 = 110,00 sin error de coma flotante)
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'manualExpenses')::numeric, 110.00::numeric,
  'periodo: gastos manuales exactos (numeric)');
-- T24: compras de inventario exactas (5 x 100,10 = 500,50)
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'inventoryPurchases')::numeric, 500.50::numeric,
  'periodo: compras de inventario exactas');
-- T25: ganancia del anio = 12000 + 3300 - 110 - 500,50
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'estimatedProfit')::numeric, 14689.50::numeric,
  'periodo: ganancia del anio');
-- T26: citas de cualquier estado (1200 + 60)
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'totalCount')::int, 1260,
  'periodo: total de citas incluye todos los estados');
-- T27: ticket medio = 10 por cita completada
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'avgTicket')::float8, 10::float8,
  'periodo: ticket medio');
-- T28: clientes nuevos no temporales del anio (a1 y a2)
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'newCustomers')::int, 2,
  'periodo: clientes nuevos excluye temporales');
-- T29: tasa de no-show = 20 / 1260 * 100
select ok(abs((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'noShowRate')::float8 - 20.0 / 1260 * 100) < 0.000001,
  'periodo: tasa de no-show sobre todas las citas');
-- T30: modulo de vitrina desactivado deja la vitrina en cero
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama', '{"retail": false, "expenses": true, "inventory": true}')->>'retailRevenue')::numeric,
  0::numeric, 'periodo: modulo retail desactivado pone vitrina a cero');

-- D. Desgloses y comisiones
-- T31: estados: completadas primero, y el total de citas suma todos los estados
select is((select sum((e->>'count')::int) from jsonb_array_elements(public.report_operational_breakdown('2030-01-01', '2030-12-31', 'America/Panama')->'statusBreakdown') e), 1260::bigint,
  'desglose: suma de estados = total de citas');
-- T32: primer estado = completed con 1200
select is((public.report_operational_breakdown('2030-01-01', '2030-12-31', 'America/Panama')->'statusBreakdown'->0->>'status'), 'completed',
  'desglose: completed es el primer estado');
-- T33: empleados: dos con 6000 cada uno
select is((select count(*)::int from jsonb_array_elements(public.report_operational_breakdown('2030-01-01', '2030-12-31', 'America/Panama')->'byEmployee') e
  where (e->>'revenue')::numeric = 6000), 2, 'desglose: revenue por empleado (600 items x 10 cada uno)');
-- T34: servicio Corte con 1200 items y 100 % (solo items de citas completadas)
select is((public.report_operational_breakdown('2030-01-01', '2030-12-31', 'America/Panama')->'byService'->0->>'count')::int, 1200,
  'desglose: servicio cuenta items de citas completadas');
-- T35: comisiones: el empleado con mayor comision (Bea Alfa, 15 %) va primero con 900,00
select is((public.report_commissions('2030-01-01', '2030-12-31', 'America/Panama')->'rows'->0->>'name'), 'Bea Alfa',
  'comisiones: orden por comision desc');
-- T36: comision de Bea = 6000 x 15 %
select is((public.report_commissions('2030-01-01', '2030-12-31', 'America/Panama')->'rows'->0->>'commission')::numeric, 900.00::numeric,
  'comisiones: 15 % sobre 6000 = 900,00');
-- T37: comision de Ana = 6000 x 10 %
select is((public.report_commissions('2030-01-01', '2030-12-31', 'America/Panama')->'rows'->1->>'commission')::numeric, 600.00::numeric,
  'comisiones: 10 % sobre 6000 = 600,00');
-- T38: totales de comisiones: 12000,00 y 1500,00
select is((public.report_commissions('2030-01-01', '2030-12-31', 'America/Panama')->>'totalCommission')::numeric, 1500.00::numeric,
  'comisiones: total de comisiones');
-- T39: comisiones de junio para Ana coinciden con la suma directa de sus items (cambio de mes)
select is((public.report_commissions('2030-06-01', '2030-06-30', 'America/Panama')->'rows'
  ->(case when (public.report_commissions('2030-06-01', '2030-06-30', 'America/Panama')->'rows'->0->>'name') = 'Ana Zeta' then 0 else 1 end)
  ->>'revenue')::numeric,
  round(current_setting('rm.e_e1_june_revenue')::numeric, 2), 'comisiones: rango de junio coincide con SQL directo');

-- E. Historial mensual, horas, gastos, productos y alertas
-- T40: 12 meses explicitos de 2030
select is(jsonb_array_length(public.report_monthly_series('2030-01', '2030-12', 'America/Panama')), 12,
  'historial: 12 meses de serie continua');
-- T41: suma de citas completadas por mes = 1200
select is((select sum((e->>'completedAppointments')::int) from jsonb_array_elements(public.report_monthly_series('2030-01', '2030-12', 'America/Panama')) e), 1200::bigint,
  'historial: citas completadas por mes exactas');
-- T42: suma de ingresos de citas por mes = 12000
select is((select sum((e->>'appointmentRevenue')::numeric) from jsonb_array_elements(public.report_monthly_series('2030-01', '2030-12', 'America/Panama')) e), 12000::numeric,
  'historial: ingresos de citas por mes');
-- T43: suma de gastos operativos por mes = 110,00
select is((select sum((e->>'operationalExpenses')::numeric) from jsonb_array_elements(public.report_monthly_series('2030-01', '2030-12', 'America/Panama')) e), 110.00::numeric,
  'historial: gastos operativos por mes');
-- T44: ganancia por mes suma la ganancia del anio
select is((select sum((e->>'profit')::numeric) from jsonb_array_elements(public.report_monthly_series('2030-01', '2030-12', 'America/Panama')) e), 14689.50::numeric,
  'historial: ganancia por mes suma el anio');
-- T45: sin meses explicitos: desde el primer mes con actividad hasta el ultimo (2030-12)
select is((public.report_monthly_series(null, null, 'America/Panama', '{"inventory": true, "retail": true, "expenses": true}', '2030-06-15 17:00:00+00')->-1->>'monthKey'), '2030-12',
  'historial: rango por defecto llega al ultimo mes con actividad');
-- T46: horas ocupadas suman citas no canceladas ni no_show (1220)
select is((select sum((e->>'total')::int) from jsonb_array_elements(public.report_busy_hours('2030-01-01', '2030-12-31', 'America/Panama')) e),
  current_setting('rm.e_busy_hours_total')::bigint, 'horas: total de citas por franja exacto');
-- T47: conceptos de gasto con restock: primero las compras (500,50)
select is((public.report_expense_concepts('2030-01-01', '2030-12-31', '{"inventory": true, "retail": true, "expenses": true}', true, 5)->0->>'amount')::numeric,
  500.50::numeric, 'gastos: reposiciones de inventario incluidas y primeras');
-- T48: sin restock, "Luz" con 550 x 0,10 = 55,00
select is((public.report_expense_concepts('2030-01-01', '2030-12-31', '{"inventory": true, "retail": true, "expenses": true}', false)->0->>'amount')::numeric,
  55.00::numeric, 'gastos: concepto Luz = 55,00 exacto');
-- T49: producto mas vendido: Acondicionador (300 unidades) antes que Shampoo (150)
select is((public.report_product_sales('2030-01', '2030-12', 'America/Panama')->0->>'name'), 'Acondicionador',
  'vitrina: producto mas vendido por cantidad');
-- T50: cantidad por mes del producto: 12 meses y suma 300
select is((select sum(x::numeric) from jsonb_array_elements(public.report_product_sales('2030-01', '2030-12', 'America/Panama')->0->'months') x), 300::numeric,
  'vitrina: cantidades por mes suman el total');
-- T51: alertas: agotados y bajos (no disponibles), por total asc y nombre
select is((select array_agg(e->>'name' order by ord) from jsonb_array_elements(public.report_inventory_alerts()) with ordinality as t(e, ord)),
  array['Acondicionador', 'Agotado', 'Bajo'], 'alertas: agotado y bajo, sin borrados ni inactivos');
-- T52: el producto bajo tiene estado bajo
select is((public.report_inventory_alerts()->-1->>'state'), 'bajo', 'alertas: estado bajo cuando total <= minimo');

-- F. Aislamiento: owner B solo ve sus datos
-- T53: owner B ve sus 3 citas (300) y no las de A
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama') ->> 'completedCount')::int, 1200,
  'aislamiento: owner A sigue viendo solo sus 1200 citas');
select set_config('request.jwt.claims',
  '{"sub":"e6000000-0000-0000-0000-00000000000b","role":"authenticated","salon_id":"e5000000-0000-0000-0000-00000000000b"}', true);
-- T54: owner B: 3 completadas y 300 de ingresos
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'completedCount')::int, 3,
  'aislamiento: owner B ve solo sus 3 citas');
-- T55: owner B: ingresos 300
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'revenue')::numeric, 300::numeric,
  'aislamiento: owner B no ve ingresos de A');
-- T56: owner B: servicios del desglose solo Servicio B
select is((public.report_operational_breakdown('2030-01-01', '2030-12-31', 'America/Panama')->'byService'->0->>'name'), 'Servicio B',
  'aislamiento: desglose de B solo con sus servicios');
-- T57: owner B: sin ventas de vitrina de A
select is((public.report_product_sales('2030-01', '2030-12', 'America/Panama')), '[]'::jsonb,
  'aislamiento: vitrina de A no visible para B');

-- G. Sin sesion: no hay salon, todo vacio/cero
select set_config('request.jwt.claims',
  '{"sub":"e6000000-0000-0000-0000-0000000000ff","role":"authenticated"}', true);
-- T58: sin salon en la sesion => cero
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'completedCount')::int, 0,
  'sin sesion: sin salon no hay citas');
-- T59: sin salon en la sesion => alertas vacias
select is(public.report_inventory_alerts(), '[]'::jsonb, 'sin sesion: alertas vacias');

-- H. Salon C sin datos (owner C)
select set_config('request.jwt.claims',
  '{"sub":"e6000000-0000-0000-0000-00000000000c","role":"authenticated","salon_id":"e5000000-0000-0000-0000-00000000000c"}', true);
-- T60: dashboard en cero
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'monthRevenue')::numeric, 0::numeric,
  'sin datos: dashboard en cero');
-- T61: serie del dashboard con 12 meses en cero y tendencia flat
select is((select count(*)::int from jsonb_array_elements(public.report_dashboard_monthly_appointments('America/Panama', '2030-06-15 17:00:00+00')) e
  where (e->>'total')::int = 0 and e->>'trend' = 'flat'), 12, 'sin datos: 12 meses en cero y flat');
-- T62: ticket medio y no-show en cero sin citas
select is((public.report_period_totals('2030-01-01', '2030-12-31', 'America/Panama')->>'noShowRate')::float8, 0::float8,
  'sin datos: tasa de no-show en cero sin division por cero');
-- T63: desgloses y comisiones vacios
select is((public.report_commissions('2030-01-01', '2030-12-31', 'America/Panama')->'rows'), '[]'::jsonb,
  'sin datos: comisiones sin filas');
-- T64: serie mensual explicita con 12 meses en cero
select is((select sum((e->>'grossRevenue')::numeric) from jsonb_array_elements(public.report_monthly_series('2030-01', '2030-12', 'America/Panama')) e), 0::numeric,
  'sin datos: historial en cero');
-- T65: horas, gastos, vitrina y alertas vacios
select is(jsonb_build_array(public.report_busy_hours('2030-01-01', '2030-12-31', 'America/Panama'),
  public.report_expense_concepts('2030-01-01', '2030-12-31'), public.report_product_sales('2030-01', '2030-12', 'America/Panama'),
  public.report_inventory_alerts()), '[[],[],[],[]]'::jsonb, 'sin datos: horas, gastos, vitrina y alertas vacios');

-- I. Salon D: bordes de medianoche local (Panama)
select set_config('request.jwt.claims',
  '{"sub":"e6000000-0000-0000-0000-00000000000d","role":"authenticated","salon_id":"e5000000-0000-0000-0000-00000000000d"}', true);
-- T66: 2030-05-31 23:30 local (04:30Z el 1 de junio) cae en mayo y no en junio
select is((public.report_period_totals('2030-05-31', '2030-05-31', 'America/Panama')->>'revenue')::numeric, 50::numeric,
  'zona horaria: 23:30 local del 31 de mayo cuenta en mayo');
-- T67: 2030-06-01 00:00 local (05:00Z) cae en junio
select is((public.report_period_totals('2030-06-01', '2030-06-01', 'America/Panama')->>'revenue')::numeric, 70::numeric,
  'zona horaria: 00:00 local del 1 de junio cuenta en junio');
-- T68: serie mensual separa mayo y junio
select is((public.report_monthly_series('2030-05', '2030-06', 'America/Panama')->1->>'appointmentRevenue')::numeric, 70::numeric,
  'zona horaria: historial separa mayo y junio');
-- T69: dashboard del 15 de junio: solo la cita de junio cuenta para el mes
select is((public.report_dashboard_metrics('America/Panama', '2030-06-15 17:00:00+00')->>'completedThisMonth')::int, 1,
  'zona horaria: mes del dashboard empieza a medianoche local');

-- J. Grants, SECURITY INVOKER y search_path
-- T70: ningun rol anon o service_role puede ejecutar las funciones nuevas
select is((select count(*)::int from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname like 'report\_%' and p.proname <> 'report_monthly_history'
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('service_role', p.oid, 'EXECUTE'))), 0,
  'grants: anon y service_role sin EXECUTE');
-- T71: PUBLIC no tiene EXECUTE (grantee 0 en la ACL)
select is((select count(*)::int from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where p.pronamespace = 'public'::regnamespace and p.proname like 'report\_%' and p.proname <> 'report_monthly_history' and a.grantee = 0 and a.privilege_type = 'EXECUTE'), 0,
  'grants: PUBLIC sin EXECUTE');
-- T72: las 14 funciones son ejecutables por authenticated
select is((select count(*)::int from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname like 'report\_%' and p.proname <> 'report_monthly_history'
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')), 14,
  'grants: 14 funciones de lectura ejecutables por authenticated');
-- T73: ninguna es SECURITY DEFINER
select is((select count(*)::int from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname like 'report\_%' and p.proname <> 'report_monthly_history' and p.prosecdef), 0,
  'seguridad: ninguna funcion de lectura es SECURITY DEFINER');
-- T74: search_path fijo en las 14
select is((select count(*)::int from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname like 'report\_%' and p.proname <> 'report_monthly_history'
    and array_to_string(p.proconfig, ',') like '%search_path=public, pg_temp%'), 14,
  'seguridad: search_path fijo en todas las funciones');

-- K. Indices de soporte
-- T75: indice salon + inicio en items
select has_index('appointment_items', 'idx_items_salon_start', array['salon_id', 'start_time'], 'indice: items por salon y inicio');
-- T76: indice de items de vitrina por salon y fecha de creacion
select has_index('retail_sale_items', 'idx_retail_sale_items_salon_created', array['salon_id', 'created_at'], 'indice: items de vitrina por salon y fecha');
-- T77: indice de clientes por salon y alta
select has_index('customers', 'idx_customers_salon_created', array['salon_id', 'created_at'], 'indice: clientes por salon y alta');

-- L. Filas por encima de 1000 sin truncado (verificacion de fixtures)
-- T78: hay 1200 citas completadas de A y 1100 ventas (fixtures como postgres)
reset role;
select ok((select count(*) from appointments where salon_id = 'e5000000-0000-0000-0000-00000000000a' and status = 'completed') = 1200
  and (select count(*) from retail_sales where salon_id = 'e5000000-0000-0000-0000-00000000000a') = 1100,
  'fixtures: mas de 1000 filas por tabla');
-- T79: items de citas completadas de A = 1200 (total del desglose)
select is((select count(*) from appointment_items i join appointments a on a.id = i.appointment_id
  where i.salon_id = 'e5000000-0000-0000-0000-00000000000a' and a.status = 'completed'), 1200::bigint,
  'fixtures: items de citas completadas');

select * from finish();
rollback;
