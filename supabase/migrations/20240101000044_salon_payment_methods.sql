alter table salons
  add column if not exists payment_methods text[] not null
    default array['cash', 'card', 'transfer', 'yappy', 'other']::text[];

update salons
set payment_methods = array['cash', 'card', 'transfer', 'yappy', 'other']::text[]
where payment_methods is null or cardinality(payment_methods) = 0;

alter table salons
  drop constraint if exists salons_payment_methods_not_empty;

alter table salons
  add constraint salons_payment_methods_not_empty
  check (
    cardinality(payment_methods) > 0
    and array_position(payment_methods, '') is null
  );

alter table appointments
  drop constraint if exists appointments_payment_method_check;

alter table appointments
  drop constraint if exists appointments_payment_method_present_when_set;

alter table appointments
  add constraint appointments_payment_method_present_when_set
  check (payment_method = '' or length(trim(payment_method)) between 1 and 64);

alter table retail_sales
  drop constraint if exists retail_sales_payment_method_check;

alter table retail_sales
  drop constraint if exists retail_sales_payment_method_present;

alter table retail_sales
  add constraint retail_sales_payment_method_present
  check (length(trim(payment_method)) between 1 and 64);

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
  v_payment_method text;
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

  v_payment_method := nullif(trim(coalesce(p_payment_method, '')), '');
  if v_payment_method is null or length(v_payment_method) > 64 then
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
    v_payment_method,
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

revoke all on function public.record_retail_sale(uuid, uuid, uuid, text, numeric, numeric, text, text) from public;
grant execute on function public.record_retail_sale(uuid, uuid, uuid, text, numeric, numeric, text, text) to authenticated;
