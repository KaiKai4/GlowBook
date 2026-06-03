-- Atomic inventory, retail and inventory purchase operations.

create or replace function public.apply_inventory_stock_delta(
  p_salon_id uuid,
  p_product_id uuid,
  p_location text,
  p_delta numeric,
  p_movement_type text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_quantity numeric;
  v_quantity_after numeric;
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salon.' using errcode = '42501';
  end if;

  if not public.has_permission('inventory.manage') then
    raise exception 'No tienes permiso para gestionar inventario.' using errcode = '42501';
  end if;

  if p_location not in ('retail', 'internal', 'storage') then
    raise exception 'Ubicacion de inventario invalida.' using errcode = '22023';
  end if;

  if p_movement_type not in ('initial', 'purchase', 'retail_sale', 'internal_use', 'adjustment', 'transfer_in', 'transfer_out') then
    raise exception 'Tipo de movimiento invalido.' using errcode = '22023';
  end if;

  if p_delta = 0 then
    raise exception 'La cantidad del movimiento debe ser diferente de cero.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventory_products
    where id = p_product_id
      and salon_id = p_salon_id
      and deleted_at is null
  ) then
    raise exception 'Producto invalido.' using errcode = '22023';
  end if;

  select quantity
    into v_current_quantity
  from public.inventory_stock_locations
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = p_location
  for update;

  if not found then
    raise exception 'No existe stock para esa ubicacion.' using errcode = '22023';
  end if;

  v_quantity_after := round(v_current_quantity + p_delta, 2);

  if v_quantity_after < 0 then
    raise exception 'Stock insuficiente para completar el movimiento.' using errcode = '22023';
  end if;

  update public.inventory_stock_locations
  set quantity = v_quantity_after
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = p_location;

  insert into public.inventory_movements (
    salon_id,
    product_id,
    location,
    movement_type,
    quantity_delta,
    quantity_after,
    reference_type,
    reference_id,
    note
  ) values (
    p_salon_id,
    p_product_id,
    p_location,
    p_movement_type,
    p_delta,
    v_quantity_after,
    p_reference_type,
    p_reference_id,
    nullif(trim(coalesce(p_note, '')), '')
  );

  return v_quantity_after;
end;
$$;

create or replace function public.record_inventory_transfer(
  p_salon_id uuid,
  p_product_id uuid,
  p_from_location text,
  p_to_location text,
  p_quantity numeric,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_quantity numeric;
  v_to_quantity numeric;
  v_from_after numeric;
  v_to_after numeric;
  v_reference_id uuid := gen_random_uuid();
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salon.' using errcode = '42501';
  end if;

  if not public.has_permission('inventory.manage') then
    raise exception 'No tienes permiso para gestionar inventario.' using errcode = '42501';
  end if;

  if p_from_location not in ('retail', 'internal', 'storage') or p_to_location not in ('retail', 'internal', 'storage') then
    raise exception 'Ubicacion de inventario invalida.' using errcode = '22023';
  end if;

  if p_from_location = p_to_location then
    raise exception 'El destino debe ser diferente al origen.' using errcode = '22023';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventory_products
    where id = p_product_id
      and salon_id = p_salon_id
      and deleted_at is null
  ) then
    raise exception 'Producto invalido.' using errcode = '22023';
  end if;

  perform 1
  from public.inventory_stock_locations
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location in (p_from_location, p_to_location)
  order by location
  for update;

  select quantity
    into v_from_quantity
  from public.inventory_stock_locations
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = p_from_location;

  select quantity
    into v_to_quantity
  from public.inventory_stock_locations
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = p_to_location;

  if v_from_quantity is null or v_to_quantity is null then
    raise exception 'No existe stock para una de las ubicaciones.' using errcode = '22023';
  end if;

  v_from_after := round(v_from_quantity - p_quantity, 2);
  v_to_after := round(v_to_quantity + p_quantity, 2);

  if v_from_after < 0 then
    raise exception 'Stock insuficiente para completar la transferencia.' using errcode = '22023';
  end if;

  update public.inventory_stock_locations
  set quantity = v_from_after
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = p_from_location;

  update public.inventory_stock_locations
  set quantity = v_to_after
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = p_to_location;

  insert into public.inventory_movements (
    salon_id,
    product_id,
    location,
    movement_type,
    quantity_delta,
    quantity_after,
    reference_type,
    reference_id,
    note
  ) values
    (
      p_salon_id,
      p_product_id,
      p_from_location,
      'transfer_out',
      -p_quantity,
      v_from_after,
      'inventory_transfer',
      v_reference_id,
      nullif(trim(coalesce(p_note, '')), '')
    ),
    (
      p_salon_id,
      p_product_id,
      p_to_location,
      'transfer_in',
      p_quantity,
      v_to_after,
      'inventory_transfer',
      v_reference_id,
      nullif(trim(coalesce(p_note, '')), '')
    );
end;
$$;

create or replace function public.record_inventory_purchase(
  p_salon_id uuid,
  p_supplier_name text,
  p_purchase_date date,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_current_quantity numeric;
  v_quantity_after numeric;
  v_total_cost numeric;
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salon.' using errcode = '42501';
  end if;

  if not public.has_permission('inventory.manage') then
    raise exception 'No tienes permiso para registrar compras de inventario.' using errcode = '42501';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.' using errcode = '22023';
  end if;

  if p_unit_cost < 0 then
    raise exception 'El costo unitario no puede ser negativo.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventory_products
    where id = p_product_id
      and salon_id = p_salon_id
      and deleted_at is null
  ) then
    raise exception 'Producto invalido.' using errcode = '22023';
  end if;

  select quantity
    into v_current_quantity
  from public.inventory_stock_locations
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = 'storage'
  for update;

  if not found then
    raise exception 'No existe stock en bodega para este producto.' using errcode = '22023';
  end if;

  v_total_cost := round(p_quantity * p_unit_cost, 2);
  v_quantity_after := round(v_current_quantity + p_quantity, 2);

  insert into public.inventory_purchases (
    salon_id,
    supplier_name,
    purchase_date,
    total_cost,
    note
  ) values (
    p_salon_id,
    nullif(trim(coalesce(p_supplier_name, '')), ''),
    p_purchase_date,
    v_total_cost,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_purchase_id;

  insert into public.inventory_purchase_items (
    salon_id,
    purchase_id,
    product_id,
    location,
    quantity,
    unit_cost,
    total_cost
  ) values (
    p_salon_id,
    v_purchase_id,
    p_product_id,
    'storage',
    p_quantity,
    p_unit_cost,
    v_total_cost
  );

  update public.inventory_stock_locations
  set quantity = v_quantity_after
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = 'storage';

  insert into public.inventory_movements (
    salon_id,
    product_id,
    location,
    movement_type,
    quantity_delta,
    quantity_after,
    reference_type,
    reference_id,
    note
  ) values (
    p_salon_id,
    p_product_id,
    'storage',
    'purchase',
    p_quantity,
    v_quantity_after,
    'inventory_purchase',
    v_purchase_id,
    nullif(trim(coalesce(p_note, p_supplier_name, '')), '')
  );

  return v_purchase_id;
end;
$$;

create or replace function public.record_retail_sale(
  p_salon_id uuid,
  p_customer_id uuid,
  p_product_id uuid,
  p_location text,
  p_quantity numeric,
  p_unit_price numeric,
  p_payment_method text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_current_quantity numeric;
  v_quantity_after numeric;
  v_total_amount numeric;
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salon.' using errcode = '42501';
  end if;

  if not public.has_permission('retail.manage') then
    raise exception 'No tienes permiso para gestionar vitrina.' using errcode = '42501';
  end if;

  if p_location not in ('retail', 'internal', 'storage') then
    raise exception 'Ubicacion de inventario invalida.' using errcode = '22023';
  end if;

  if p_payment_method not in ('cash', 'card', 'transfer', 'yappy', 'other') then
    raise exception 'Metodo de pago invalido.' using errcode = '22023';
  end if;

  if p_quantity <= 0 or p_quantity <> trunc(p_quantity) then
    raise exception 'La cantidad de venta debe ser un entero mayor que cero.' using errcode = '22023';
  end if;

  if p_unit_price < 0 then
    raise exception 'El precio unitario no puede ser negativo.' using errcode = '22023';
  end if;

  if p_customer_id is not null and not exists (
    select 1
    from public.customers
    where id = p_customer_id
      and salon_id = p_salon_id
  ) then
    raise exception 'Cliente invalido.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventory_products
    where id = p_product_id
      and salon_id = p_salon_id
      and is_active = true
      and is_retail_enabled = true
      and deleted_at is null
  ) then
    raise exception 'Este producto no esta habilitado para venta en vitrina.' using errcode = '22023';
  end if;

  select quantity
    into v_current_quantity
  from public.inventory_stock_locations
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = p_location
  for update;

  if not found then
    raise exception 'No existe stock para esa ubicacion.' using errcode = '22023';
  end if;

  v_quantity_after := round(v_current_quantity - p_quantity, 2);

  if v_quantity_after < 0 then
    raise exception 'Stock insuficiente para completar la venta.' using errcode = '22023';
  end if;

  v_total_amount := round(p_quantity * p_unit_price, 2);

  insert into public.retail_sales (
    salon_id,
    customer_id,
    payment_method,
    total_amount,
    note
  ) values (
    p_salon_id,
    p_customer_id,
    p_payment_method,
    v_total_amount,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_sale_id;

  insert into public.retail_sale_items (
    salon_id,
    sale_id,
    product_id,
    location,
    quantity,
    unit_price,
    total_price
  ) values (
    p_salon_id,
    v_sale_id,
    p_product_id,
    p_location,
    p_quantity,
    p_unit_price,
    v_total_amount
  );

  update public.inventory_stock_locations
  set quantity = v_quantity_after
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = p_location;

  insert into public.inventory_movements (
    salon_id,
    product_id,
    location,
    movement_type,
    quantity_delta,
    quantity_after,
    reference_type,
    reference_id,
    note
  ) values (
    p_salon_id,
    p_product_id,
    p_location,
    'retail_sale',
    -p_quantity,
    v_quantity_after,
    'retail_sale',
    v_sale_id,
    nullif(trim(coalesce(p_note, 'Venta de vitrina')), '')
  );

  return v_sale_id;
end;
$$;

revoke all on function public.apply_inventory_stock_delta(uuid, uuid, text, numeric, text, text, uuid, text) from public;
revoke all on function public.record_inventory_transfer(uuid, uuid, text, text, numeric, text) from public;
revoke all on function public.record_inventory_purchase(uuid, text, date, uuid, numeric, numeric, text) from public;
revoke all on function public.record_retail_sale(uuid, uuid, uuid, text, numeric, numeric, text, text) from public;

grant execute on function public.apply_inventory_stock_delta(uuid, uuid, text, numeric, text, text, uuid, text) to authenticated;
grant execute on function public.record_inventory_transfer(uuid, uuid, text, text, numeric, text) to authenticated;
grant execute on function public.record_inventory_purchase(uuid, text, date, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.record_retail_sale(uuid, uuid, uuid, text, numeric, numeric, text, text) to authenticated;
