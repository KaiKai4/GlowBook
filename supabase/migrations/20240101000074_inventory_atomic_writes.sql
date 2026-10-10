-- Escrituras de inventario atomicas: alta de producto con stock inicial y edicion de producto con
-- sus minimos.
--
-- Problema: src/features/inventory hacia varias llamadas independientes desde el repositorio.
--   * createInventoryProduct: insert del producto, insert de las tres ubicaciones de stock y un
--     movimiento "initial" por ubicacion. Un fallo a mitad dejaba producto sin stock o sin movimientos.
--   * updateInventoryProductProfile: update del producto y despues tres updates de minimos.
--     Un fallo dejaba el producto con datos nuevos y minimos antiguos (o al reves).
--
-- Solucion: dos RPC SECURITY INVOKER. Una llamada RPC es una transaccion: si cualquier paso falla,
-- no queda nada escrito. La RLS de inventory_products, inventory_stock_locations e
-- inventory_movements aplica, y ademas se exige inventory.manage (42501) para devolver un error claro.
-- Igual que record_inventory_transfer, reciben p_salon_id y lo comparan con el claim (42501 si no
-- coincide).
--   * create_inventory_product_with_stock(...) returns uuid
--     Entradas invalidas (nombre vacio, precio o cantidad negativos): 22023. Nombre repetido en el
--     salon: 23505 (sin escribir stock ni movimientos).
--   * update_inventory_product_profile(...) returns void
--     Producto inexistente, archivado o de otro salon: P0002. Entradas invalidas: 22023.
--
-- No se usa idempotency_key: estas escrituras no la usaban antes y no son reintentos de cobro o stock.
-- Forward-only: no cambia tablas ni datos; solo añade funciones y grants.

set lock_timeout = '2s';
set statement_timeout = '30s';

begin;

-- 1. Alta de producto con sus tres ubicaciones y los movimientos de stock inicial.
create or replace function public.create_inventory_product_with_stock(
  p_salon_id uuid,
  p_name text,
  p_category text,
  p_cost_price numeric,
  p_sale_price numeric,
  p_is_retail_enabled boolean,
  p_retail_quantity numeric,
  p_retail_minimum numeric,
  p_internal_quantity numeric,
  p_internal_minimum numeric,
  p_storage_quantity numeric,
  p_storage_minimum numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_product uuid;
begin
  if p_salon_id is distinct from v_salon then
    raise exception 'No tienes acceso a este salon.' using errcode = '42501';
  end if;

  if not public.has_permission('inventory.manage') then
    raise exception 'No tienes permiso para gestionar inventario.' using errcode = '42501';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'El nombre del producto es obligatorio.' using errcode = '22023';
  end if;

  if p_cost_price is null or p_cost_price < 0 or p_sale_price is null or p_sale_price < 0 then
    raise exception 'Los precios no pueden ser negativos.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(array[
      p_retail_quantity, p_retail_minimum,
      p_internal_quantity, p_internal_minimum,
      p_storage_quantity, p_storage_minimum
    ]) as v
    where v is null or v < 0
  ) then
    raise exception 'Las cantidades y los minimos no pueden ser negativos.' using errcode = '22023';
  end if;

  insert into public.inventory_products (salon_id, name, category, cost_price, sale_price, is_retail_enabled)
  values (
    v_salon,
    btrim(p_name),
    nullif(btrim(coalesce(p_category, '')), ''),
    p_cost_price,
    p_sale_price,
    coalesce(p_is_retail_enabled, false)
  )
  returning id into v_product;

  insert into public.inventory_stock_locations (salon_id, product_id, location, quantity, minimum_quantity)
  values
    (v_salon, v_product, 'retail', p_retail_quantity, p_retail_minimum),
    (v_salon, v_product, 'internal', p_internal_quantity, p_internal_minimum),
    (v_salon, v_product, 'storage', p_storage_quantity, p_storage_minimum);

  insert into public.inventory_movements (
    salon_id, product_id, location, movement_type, quantity_delta, quantity_after, note
  )
  select v_salon, v_product, s.location, 'initial', s.quantity, s.quantity, 'Stock inicial'
  from public.inventory_stock_locations s
  where s.product_id = v_product
    and s.quantity > 0;

  return v_product;
end;
$$;

-- 2. Edicion de producto y de sus minimos por ubicacion.
create or replace function public.update_inventory_product_profile(
  p_salon_id uuid,
  p_product_id uuid,
  p_name text,
  p_category text,
  p_cost_price numeric,
  p_sale_price numeric,
  p_is_retail_enabled boolean,
  p_is_active boolean,
  p_retail_minimum numeric,
  p_internal_minimum numeric,
  p_storage_minimum numeric
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
begin
  if p_salon_id is distinct from v_salon then
    raise exception 'No tienes acceso a este salon.' using errcode = '42501';
  end if;

  if not public.has_permission('inventory.manage') then
    raise exception 'No tienes permiso para gestionar inventario.' using errcode = '42501';
  end if;

  perform 1
  from public.inventory_products p
  where p.id = p_product_id
    and p.salon_id = v_salon
    and p.deleted_at is null
  for update;

  if not found then
    raise exception 'Producto no encontrado.' using errcode = 'P0002';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'El nombre del producto es obligatorio.' using errcode = '22023';
  end if;

  if p_cost_price is null or p_cost_price < 0 or p_sale_price is null or p_sale_price < 0 then
    raise exception 'Los precios no pueden ser negativos.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(array[p_retail_minimum, p_internal_minimum, p_storage_minimum]) as v
    where v is null or v < 0
  ) then
    raise exception 'Los minimos no pueden ser negativos.' using errcode = '22023';
  end if;

  update public.inventory_products
  set name = btrim(p_name),
      category = nullif(btrim(coalesce(p_category, '')), ''),
      cost_price = p_cost_price,
      sale_price = p_sale_price,
      is_retail_enabled = coalesce(p_is_retail_enabled, false),
      is_active = coalesce(p_is_active, true)
  where id = p_product_id
    and salon_id = v_salon;

  update public.inventory_stock_locations
  set minimum_quantity = case location
        when 'retail' then p_retail_minimum
        when 'internal' then p_internal_minimum
        else p_storage_minimum
      end
  where product_id = p_product_id
    and salon_id = v_salon;
end;
$$;

-- 3. Grants: nadie por defecto; solo usuarios autenticados (cliente de usuario).
revoke all on function public.create_inventory_product_with_stock(uuid, text, text, numeric, numeric, boolean, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon, service_role;
grant execute on function public.create_inventory_product_with_stock(uuid, text, text, numeric, numeric, boolean, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;

revoke all on function public.update_inventory_product_profile(uuid, uuid, text, text, numeric, numeric, boolean, boolean, numeric, numeric, numeric) from public, anon, service_role;
grant execute on function public.update_inventory_product_profile(uuid, uuid, text, text, numeric, numeric, boolean, boolean, numeric, numeric, numeric) to authenticated;

commit;
