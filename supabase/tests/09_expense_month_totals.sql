-- Totales del mes de gastos en la base (migracion 20240101000068, F02-2).
-- Antes, getExpensesPage sumaba en JS una lista limitada a 40 gastos. Esta prueba fija que la
-- funcion agrega sin limite: 45 gastos manuales en junio + una compra de inventario en el salon A.
--
-- Datos (anio 2030):
--   * Salon A, junio: 30 gastos "rent" de 100 y 15 gastos "utilities" de 10 (45 gastos = 3150),
--     y una compra de inventario de 200 el 15 de junio. Total esperado del mes: 3350.
--   * Salon A, fuera de junio: gasto "supplies" de 999 el 31 de mayo, gasto de 1 el 1 de julio
--     y compra de 777 el 2 de julio.
--   * Salon B, junio: gasto "rent" de 5000 y compra de 300.
begin;
select plan(11);

-- Fixtures (como postgres, saltando RLS)
insert into auth.users (id, email, aud, role) values
  ('d9000000-0000-0000-0000-00000000000a', 'owner.a@glowbook.test', 'authenticated', 'authenticated'),
  ('d9000000-0000-0000-0000-00000000000b', 'owner.b@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name) values
  ('d1000000-0000-0000-0000-00000000000a', 'Salon A'),
  ('d1000000-0000-0000-0000-00000000000b', 'Salon B');

insert into profiles (id, salon_id, is_owner, full_name) values
  ('d9000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000a', true, 'Owner A'),
  ('d9000000-0000-0000-0000-00000000000b', 'd1000000-0000-0000-0000-00000000000b', true, 'Owner B');

insert into expenses (salon_id, expense_date, category, amount, concept)
select 'd1000000-0000-0000-0000-00000000000a', date '2030-06-01' + g, 'rent', 100, 'Alquiler'
from generate_series(0, 29) g;

insert into expenses (salon_id, expense_date, category, amount, concept)
select 'd1000000-0000-0000-0000-00000000000a', date '2030-06-02' + g, 'utilities', 10, 'Luz'
from generate_series(0, 14) g;

insert into expenses (salon_id, expense_date, category, amount, concept) values
  ('d1000000-0000-0000-0000-00000000000a', '2030-05-31', 'supplies', 999, 'Fuera de rango (mayo)'),
  ('d1000000-0000-0000-0000-00000000000a', '2030-07-01', 'supplies', 1, 'Fuera de rango (julio)'),
  ('d1000000-0000-0000-0000-00000000000b', '2030-06-10', 'rent', 5000, 'Salon B');

insert into inventory_purchases (salon_id, purchase_date, total_cost) values
  ('d1000000-0000-0000-0000-00000000000a', '2030-06-15', 200),
  ('d1000000-0000-0000-0000-00000000000a', '2030-07-02', 777),
  ('d1000000-0000-0000-0000-00000000000b', '2030-06-10', 300);

-- Sesion de owner A (authenticated), como en produccion.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d9000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"d1000000-0000-0000-0000-00000000000a"}', true);

-- T01: 45 gastos manuales del mes + 1 compra = 3 filas agregadas (rent, utilities, products)
select is(
  (select count(*)::int from public.report_expense_month_totals('d1000000-0000-0000-0000-00000000000a', '2030-06-01', '2030-06-30')),
  3,
  'agregado: una fila por categoria (rent, utilities, products)'
);

-- T02: el total no se trunca a 40 gastos: 3000 + 150 + 200 = 3350
select is(
  (select coalesce(sum(amount), 0)::numeric from public.report_expense_month_totals('d1000000-0000-0000-0000-00000000000a', '2030-06-01', '2030-06-30')),
  3350::numeric,
  'total del mes: suma los 45 gastos y la compra sin limite de lista'
);

-- T03: desglose de alquiler (30 x 100)
select is(
  (select amount from public.report_expense_month_totals('d1000000-0000-0000-0000-00000000000a', '2030-06-01', '2030-06-30') where category = 'rent'),
  3000::numeric,
  'desglose: alquiler suma 30 gastos de 100'
);

-- T04: desglose de servicios (15 x 10), sin categoria personalizada
select is(
  (select amount from public.report_expense_month_totals('d1000000-0000-0000-0000-00000000000a', '2030-06-01', '2030-06-30') where category = 'utilities' and custom_category is null),
  150::numeric,
  'desglose: servicios suma 15 gastos de 10'
);

-- T05: las compras de inventario van a products sin categoria personalizada
select is(
  (select amount from public.report_expense_month_totals('d1000000-0000-0000-0000-00000000000a', '2030-06-01', '2030-06-30') where category = 'products'),
  200::numeric,
  'desglose: compra de inventario cuenta como products'
);

-- T06: los gastos y compras fuera del rango no cuentan (mayo, julio)
select is(
  (select coalesce(sum(amount), 0)::numeric from public.report_expense_month_totals('d1000000-0000-0000-0000-00000000000a', '2030-06-01', '2030-06-30')),
  3350::numeric,
  'rango: gastos de mayo y julio y compra de julio quedan fuera'
);

-- T07: rango de julio solo cuenta lo de julio (1 + 777)
select is(
  (select coalesce(sum(amount), 0)::numeric from public.report_expense_month_totals('d1000000-0000-0000-0000-00000000000a', '2030-07-01', '2030-07-31')),
  778::numeric,
  'rango: julio suma solo sus gastos y compras'
);

-- T08: owner A pidiendo el salon B no ve importes de B (filtro por salon y RLS)
select is(
  (select coalesce(sum(amount), 0)::numeric from public.report_expense_month_totals('d1000000-0000-0000-0000-00000000000b', '2030-06-01', '2030-06-30')),
  0::numeric,
  'aislamiento: owner A no ve gastos ni compras del salon B'
);

-- Sesion de owner B
select set_config('request.jwt.claims',
  '{"sub":"d9000000-0000-0000-0000-00000000000b","role":"authenticated","salon_id":"d1000000-0000-0000-0000-00000000000b"}', true);

-- T09: owner B ve solo su total (5000 + 300)
select is(
  (select coalesce(sum(amount), 0)::numeric from public.report_expense_month_totals('d1000000-0000-0000-0000-00000000000b', '2030-06-01', '2030-06-30')),
  5300::numeric,
  'aislamiento: owner B ve solo sus 5300 del mes'
);

-- T10: owner B pidiendo el salon A no ve nada
select is(
  (select coalesce(sum(amount), 0)::numeric from public.report_expense_month_totals('d1000000-0000-0000-0000-00000000000a', '2030-06-01', '2030-06-30')),
  0::numeric,
  'aislamiento: owner B no ve gastos ni compras del salon A'
);

reset role;

-- T11: grants: solo authenticated puede ejecutar la funcion
select ok(
  has_function_privilege('authenticated', 'public.report_expense_month_totals(uuid,date,date)', 'execute')
  and not has_function_privilege('anon', 'public.report_expense_month_totals(uuid,date,date)', 'execute')
  and not has_function_privilege('service_role', 'public.report_expense_month_totals(uuid,date,date)', 'execute'),
  'grants: execute solo para authenticated (anon y service_role revocados)'
);

select * from finish();
rollback;
