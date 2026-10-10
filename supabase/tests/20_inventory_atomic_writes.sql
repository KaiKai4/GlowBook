-- RPC de inventario atomicas: create_inventory_product_with_stock y update_inventory_product_profile.
-- Alta de producto con stock inicial y movimientos, y edicion de producto con sus minimos, en una
-- sola transaccion. Ambas son security invoker: la RLS de inventory_* aplica, se exige
-- inventory.manage (42501) y p_salon_id debe ser el salon del claim (42501). Entradas invalidas:
-- 22023. Producto inexistente o de otro salon: P0002. Un fallo deja la base intacta.
begin;
select plan(24);

-- Fixtures (como postgres)
insert into auth.users (id, email, aud, role) values
  ('c0000000-0000-0000-0000-00000000000a', 'owner.inv@glowbook.test', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'citas.inv@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name) values
  ('c1000000-0000-0000-0000-000000000001', 'Salon INV A'),
  ('c1000000-0000-0000-0000-000000000002', 'Salon INV B');

insert into roles (id, salon_id, name) values
  ('c6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Citas INV');

insert into role_permissions (role_id, permission_id, salon_id) values
  ('c6000000-0000-0000-0000-000000000001',
   (select id from permissions where key = 'appointments.manage'),
   'c1000000-0000-0000-0000-000000000001');

insert into profiles (id, salon_id, role_id, is_owner, full_name) values
  ('c0000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-000000000001', null, true, 'Owner INV'),
  ('c0000000-0000-0000-0000-00000000000c', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', false, 'Citas INV');

insert into inventory_products (id, salon_id, name, cost_price, sale_price) values
  ('c2000000-0000-0000-0000-00000000000b', 'c1000000-0000-0000-0000-000000000002', 'Ajeno', 1, 2);

-- Grants y modo de seguridad (como postgres)
select ok(
  has_function_privilege('authenticated', 'public.create_inventory_product_with_stock(uuid,text,text,numeric,numeric,boolean,numeric,numeric,numeric,numeric,numeric,numeric)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.update_inventory_product_profile(uuid,uuid,text,text,numeric,numeric,boolean,boolean,numeric,numeric,numeric)', 'EXECUTE'),
  'authenticated puede ejecutar las dos RPC de inventario'
);

select ok(
  not has_function_privilege('anon', 'public.create_inventory_product_with_stock(uuid,text,text,numeric,numeric,boolean,numeric,numeric,numeric,numeric,numeric,numeric)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_inventory_product_profile(uuid,uuid,text,text,numeric,numeric,boolean,boolean,numeric,numeric,numeric)', 'EXECUTE'),
  'anon no ejecuta las RPC de inventario'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.create_inventory_product_with_stock(uuid,text,text,numeric,numeric,boolean,numeric,numeric,numeric,numeric,numeric,numeric)'::regprocedure),
  false,
  'create_inventory_product_with_stock es security invoker'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.update_inventory_product_profile(uuid,uuid,text,text,numeric,numeric,boolean,boolean,numeric,numeric,numeric)'::regprocedure),
  false,
  'update_inventory_product_profile es security invoker'
);

-- Sesion del owner del salon A
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"c1000000-0000-0000-0000-000000000001"}',
  true
);

-- Alta con stock inicial: retail 5 (min 2), internal 0 (min 1), storage 10 (min 3)
select set_config(
  'test.inv_producto',
  public.create_inventory_product_with_stock(
    'c1000000-0000-0000-0000-000000000001', 'Tinte', 'Color', 12.5, 25, true, 5, 2, 0, 1, 10, 3
  )::text,
  true
);

select ok(current_setting('test.inv_producto') <> '', 'create_inventory_product_with_stock devuelve el id del producto');

select is(
  (select salon_id::text from inventory_products where id = current_setting('test.inv_producto')::uuid),
  'c1000000-0000-0000-0000-000000000001',
  'el producto queda en el salon del claim'
);

select is(
  (select count(*)::int from inventory_stock_locations where product_id = current_setting('test.inv_producto')::uuid),
  3,
  'se crean las tres ubicaciones de stock aunque una tenga cantidad cero'
);

select is(
  (select quantity::numeric from inventory_stock_locations
    where product_id = current_setting('test.inv_producto')::uuid and location = 'retail'),
  5::numeric,
  'la cantidad de Vitrina queda como se indico'
);

select is(
  (select count(*)::int from inventory_movements
    where product_id = current_setting('test.inv_producto')::uuid and movement_type = 'initial'),
  2,
  'solo se registra movimiento inicial para las ubicaciones con cantidad mayor que cero'
);

select is(
  (select sum(quantity_after)::numeric from inventory_movements
    where product_id = current_setting('test.inv_producto')::uuid),
  15::numeric,
  'los movimientos iniciales registran la cantidad resultante de cada ubicacion'
);

-- Un salon distinto al del claim se rechaza antes de escribir nada
select throws_ok(
  $$select public.create_inventory_product_with_stock(
      'c1000000-0000-0000-0000-000000000002', 'Cruzado', null, 1, 1, false, 0, 0, 0, 0, 0, 0)$$,
  '42501',
  null,
  'no se puede crear un producto en un salon ajeno'
);

-- Entrada invalida: ningun producto ni stock queda escrito
select throws_ok(
  $$select public.create_inventory_product_with_stock(
      'c1000000-0000-0000-0000-000000000001', 'Atomico', null, 1, 1, false, 1, 0, 0, 0, -1, 0)$$,
  '22023',
  null,
  'una cantidad negativa se rechaza con 22023'
);

select is(
  (select count(*)::int from inventory_products where name = 'Atomico'),
  0,
  'la entrada rechazada no deja producto escrito'
);

-- Nombre duplicado en el mismo salon: falla antes de tocar stock o movimientos
select throws_ok(
  $$select public.create_inventory_product_with_stock(
      'c1000000-0000-0000-0000-000000000001', 'Tinte', null, 1, 1, false, 0, 0, 0, 0, 0, 0)$$,
  '23505',
  null,
  'un nombre repetido en el salon devuelve 23505'
);

select is(
  (select count(*)::int from inventory_movements where note = 'Stock inicial'),
  2,
  'el duplicado no añade movimientos de stock inicial'
);

-- Edicion del producto: nombre, precio, activo y minimos
select lives_ok(
  $$select public.update_inventory_product_profile(
      'c1000000-0000-0000-0000-000000000001', current_setting('test.inv_producto')::uuid,
      'Tinte premium', 'Color', 14, 30, false, true, 4, 1, 3)$$,
  'la edicion de un producto propio se ejecuta'
);

select is(
  (select name from inventory_products where id = current_setting('test.inv_producto')::uuid),
  'Tinte premium',
  'la edicion cambia el nombre del producto'
);

select is(
  (select sale_price::numeric from inventory_products where id = current_setting('test.inv_producto')::uuid),
  30::numeric,
  'la edicion cambia el precio de venta'
);

select is(
  (select minimum_quantity::numeric from inventory_stock_locations
    where product_id = current_setting('test.inv_producto')::uuid and location = 'retail'),
  4::numeric,
  'la edicion actualiza el minimo de Vitrina'
);

select throws_ok(
  $$select public.update_inventory_product_profile(
      'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-00000000000b',
      'Robado', null, 1, 2, false, true, 0, 0, 0)$$,
  'P0002',
  null,
  'un producto de otro salon no se puede editar'
);

select throws_ok(
  $$select public.update_inventory_product_profile(
      'c1000000-0000-0000-0000-000000000001', current_setting('test.inv_producto')::uuid,
      'Tinte premium', null, -1, 30, false, true, 4, 1, 3)$$,
  '22023',
  null,
  'un precio negativo se rechaza con 22023'
);

-- Sin inventory.manage: el rol Citas no puede crear ni editar
select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated","salon_id":"c1000000-0000-0000-0000-000000000001"}',
  true
);

select throws_ok(
  $$select public.create_inventory_product_with_stock(
      'c1000000-0000-0000-0000-000000000001', 'Sin permiso', null, 1, 1, false, 0, 0, 0, 0, 0, 0)$$,
  '42501',
  null,
  'sin inventory.manage no se puede crear un producto'
);

select throws_ok(
  $$select public.update_inventory_product_profile(
      'c1000000-0000-0000-0000-000000000001', current_setting('test.inv_producto')::uuid,
      'Hackeado', null, 1, 1, false, true, 0, 0, 0)$$,
  '42501',
  null,
  'sin inventory.manage no se puede editar un producto'
);

select is(
  (select count(*)::int from inventory_products where name in ('Sin permiso', 'Hackeado')),
  0,
  'los intentos sin permiso no dejan nada escrito'
);

select * from finish();
rollback;
