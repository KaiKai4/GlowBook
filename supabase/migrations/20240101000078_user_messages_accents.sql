-- Migración 078: tildes y ortografía en los mensajes de error visibles al usuario.
-- Solo cambia el texto de los `raise exception`: no cambia firmas, lógica, SQLSTATE,
-- `security`, `search_path` ni grants (CREATE OR REPLACE conserva los privilegios).
-- Los mensajes técnicos o de log en inglés no se tocan.
-- Coordina con src/features/appointments/data/rpc/rpc-failure-reason.ts y las pruebas que comparan estos textos.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.apply_inventory_stock_delta(p_salon_id uuid, p_product_id uuid, p_location text, p_delta numeric, p_movement_type text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_quantity numeric;
  v_quantity_after numeric;
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salón.' using errcode = '42501';
  end if;

  if not public.has_permission('inventory.manage') then
    raise exception 'No tienes permiso para gestionar inventario.' using errcode = '42501';
  end if;

  if p_location not in ('retail', 'internal', 'storage') then
    raise exception 'Ubicación de inventario inválida.' using errcode = '22023';
  end if;

  if p_movement_type not in ('initial', 'purchase', 'retail_sale', 'internal_use', 'adjustment', 'transfer_in', 'transfer_out') then
    raise exception 'Tipo de movimiento inválido.' using errcode = '22023';
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
    raise exception 'Producto inválido.' using errcode = '22023';
  end if;

  select quantity
    into v_current_quantity
  from public.inventory_stock_locations
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = p_location
  for update;

  if not found then
    raise exception 'No existe stock para esa ubicación.' using errcode = '22023';
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
$function$;

CREATE OR REPLACE FUNCTION public.close_appointment_without_charge(p_appointment_id uuid, p_salon_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_status text;
begin
  if p_status not in ('cancelled', 'no_show') then
    raise exception 'Estado de cierre inválido.' using errcode = '22023';
  end if;

  select a.status
    into v_status
  from public.appointments a
  where a.id = p_appointment_id
    and a.salon_id = p_salon_id
  for update;

  if not found then
    raise exception 'Cita no encontrada.';
  end if;

  if v_status not in ('scheduled', 'confirmed') then
    raise exception 'No se puede cambiar el estado de "%" a "%".', v_status, p_status;
  end if;

  -- Libera la agenda antes de cerrar la cabecera (como en la app).
  update public.appointment_items
  set blocks_calendar = false
  where appointment_id = p_appointment_id
    and salon_id = p_salon_id;

  update public.appointments
  set status = p_status
  where id = p_appointment_id
    and salon_id = p_salon_id;

  return jsonb_build_object('appointment_id', p_appointment_id, 'status', p_status);
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_appointment(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_salon uuid := public.salon_id();
  v_appt_id uuid := (payload ->> 'appointment_id')::uuid;
  v_idem_key uuid := nullif(payload ->> 'idempotency_key', '')::uuid;
  v_method text := lower(btrim(coalesce(payload ->> 'payment_method', '')));
  v_note text := left(btrim(coalesce(payload ->> 'completion_price_note', '')), 500);
  v_charges jsonb := coalesce(payload -> 'item_charges', '[]'::jsonb);
  v_replay jsonb;
  v_status text;
  v_item_count int;
  v_item record;
  v_charge jsonb;
  v_submitted_price numeric;
  v_discount_pct numeric;
  v_next_price numeric;
  v_next_discount numeric;
  v_subtotal numeric := 0;
  v_discount_total numeric := 0;
  v_final_total numeric;
  v_result jsonb;
begin
  if v_salon is null then
    raise exception 'No autenticado';
  end if;

  if not public.has_permission('appointments.manage') then
    raise exception 'No tienes permiso para gestionar citas.';
  end if;

  if v_idem_key is not null then
    v_replay := public.idempotency_begin(
      'complete_appointment',
      v_idem_key,
      encode(sha256(convert_to((payload - 'idempotency_key')::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return v_replay;
    end if;
  end if;

  if v_method = '' or length(v_method) > 64 then
    raise exception 'Método de pago inválido.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.salons s, unnest(s.payment_methods) as m(name)
    where s.id = v_salon
      and lower(m.name) = v_method
  ) then
    raise exception 'Ese método de pago no está habilitado para este salón.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_charges) <> 'array' then
    raise exception 'Cobros de servicios inválidos.' using errcode = '22023';
  end if;

  select a.status
    into v_status
  from public.appointments a
  where a.id = v_appt_id
    and a.salon_id = v_salon
  for update;

  if not found then
    raise exception 'Cita no encontrada.';
  end if;

  if v_status not in ('scheduled', 'confirmed') then
    raise exception 'No se puede cambiar el estado de "%" a "%".', v_status, 'completed';
  end if;

  select count(*)::int
    into v_item_count
  from public.appointment_items ai
  where ai.appointment_id = v_appt_id
    and ai.salon_id = v_salon;

  if v_item_count = 0 then
    raise exception 'La cita no tiene servicios para cobrar.';
  end if;

  -- Validacion de los cobros enviados (mismo orden que la app).
  for v_charge in select value from jsonb_array_elements(v_charges) as e(value)
  loop
    if not exists (
      select 1
      from public.appointment_items ai
      where ai.id = (v_charge ->> 'id')::uuid
        and ai.appointment_id = v_appt_id
        and ai.salon_id = v_salon
    ) then
      raise exception 'Precio de servicio inválido.';
    end if;

    v_submitted_price := (v_charge ->> 'price')::numeric;
    if v_submitted_price is null then
      raise exception 'Precio de servicio inválido.';
    end if;
    if v_submitted_price < 0 then
      raise exception 'El precio del servicio no puede ser negativo.';
    end if;

    v_discount_pct := coalesce((v_charge ->> 'discount_percentage')::numeric, 0);
    if v_discount_pct < 0 or v_discount_pct > 100 then
      raise exception 'El descuento del servicio debe estar entre 0%% y 100%%.';
    end if;
  end loop;

  -- Calculo por item y cambios de precio permitidos solo en categorias de precio variable.
  for v_item in
    select
      ai.id,
      round(ai.price, 2) as current_price,
      round(ai.discount_amount, 2) as current_discount,
      (case when sc.pricing_mode = 'variable' then 'variable' else 'fixed' end) as pricing_mode
    from public.appointment_items ai
    left join public.services sv on sv.id = ai.service_id
    left join public.service_categories sc on sc.id = sv.category_id
    where ai.appointment_id = v_appt_id
      and ai.salon_id = v_salon
    order by ai.ordering, ai.id
  loop
    -- Ultimo cobro enviado para el item (si hay duplicados, gana el ultimo, como en la app).
    select e.value
      into v_charge
    from jsonb_array_elements(v_charges) with ordinality as e(value, idx)
    where e.value ->> 'id' = v_item.id::text
    order by e.idx desc
    limit 1;

    if v_charge is not null then
      v_next_price := round((v_charge ->> 'price')::numeric, 2);
      v_discount_pct := least(100, greatest(0, coalesce((v_charge ->> 'discount_percentage')::numeric, 0)));
    else
      v_next_price := v_item.current_price;
      v_discount_pct := 0;
    end if;

    if v_next_price <> v_item.current_price and v_item.pricing_mode <> 'variable' then
      raise exception 'Solo puedes cambiar el precio de servicios con precio variable.';
    end if;

    v_next_discount := round(v_next_price * (v_discount_pct / 100), 2);

    if v_next_price <> v_item.current_price or v_next_discount <> v_item.current_discount then
      update public.appointment_items
      set price = v_next_price,
          discount_amount = v_next_discount
      where id = v_item.id
        and appointment_id = v_appt_id
        and salon_id = v_salon;
    end if;

    v_subtotal := v_subtotal + v_next_price;
    v_discount_total := v_discount_total + v_next_discount;
  end loop;

  v_subtotal := round(v_subtotal, 2);
  v_discount_total := round(v_discount_total, 2);
  v_final_total := round(greatest(0, v_subtotal - v_discount_total), 2);

  update public.appointments
  set status = 'completed',
      payment_method = v_method,
      discount_amount = v_discount_total,
      total_price = v_final_total,
      completion_price_note = v_note
  where id = v_appt_id
    and salon_id = v_salon;

  update public.appointment_items
  set blocks_calendar = false
  where appointment_id = v_appt_id
    and salon_id = v_salon;

  -- Un cliente temporal (creado al agendar sin ficha) pasa a ser cliente de la ficha al completar la cita.
  -- Dentro de la misma transaccion: antes lo hacia la app tras el commit y podia quedar a medias.
  -- Solo afecta a clientes temporales: un cliente archivado no se reactiva al completar una cita.
  update public.customers c
  set is_temporary = false,
      is_active = true
  where c.salon_id = v_salon
    and c.is_temporary = true
    and c.id = (select a.customer_id from public.appointments a where a.id = v_appt_id);

  v_result := jsonb_build_object(
    'appointment_id', v_appt_id,
    'status', 'completed',
    'subtotal', v_subtotal,
    'discount_amount', v_discount_total,
    'total_price', v_final_total
  );

  if v_idem_key is not null then
    perform public.idempotency_finish('complete_appointment', v_idem_key, v_result);
  end if;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key text, p_max integer, p_window_seconds integer)
 RETURNS TABLE(allowed boolean, retry_after_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_count bigint;
  v_expires_at timestamptz;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    raise exception 'clave de rate limit inválida' using errcode = '22023';
  end if;

  if p_max is null or p_max <= 0 then
    raise exception 'p_max debe ser mayor que 0' using errcode = '22023';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'p_window_seconds debe estar entre 1 y 86400' using errcode = '22023';
  end if;

  delete from public.rate_limit_buckets
  where key in (
    select expired.key
    from public.rate_limit_buckets expired
    where expired.expires_at <= v_now
    order by expired.expires_at
    limit 100
  );

  insert into public.rate_limit_buckets as b (key, window_started_at, count, expires_at)
  values (p_key, v_now, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set window_started_at = case
          when b.expires_at <= v_now then v_now
          else b.window_started_at
        end,
        count = case
          when b.expires_at <= v_now then 1
          when b.count <= p_max then b.count + 1
          else b.count
        end,
        expires_at = case
          when b.expires_at <= v_now then v_now + make_interval(secs => p_window_seconds)
          else b.expires_at
        end
  returning b.count, b.expires_at into v_count, v_expires_at;

  return query select
    v_count <= p_max,
    case
      when v_count <= p_max then 0
      else greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer)
    end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.count_salon_usage(p_salon_id uuid, p_counters jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  item jsonb;
  result jsonb := '{}'::jsonb;
  v_count bigint;
  v_from timestamptz;
  v_to timestamptz;
begin
  -- service_role (backend admin) no se acota: se comprueba primero para no evaluar
  -- public.salon_id() con ese rol. Un usuario solo cuenta su propio salon o es plataforma.
  if (select auth.role()) is distinct from 'service_role' then
    if not (
      p_salon_id = (select public.salon_id())
      or (select public.is_platform_admin())
    ) then
      raise exception 'Sin acceso al uso de otro salón' using errcode = '42501';
    end if;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_counters, '[]'::jsonb)) loop
    v_from := nullif(item->>'from', '')::timestamptz;
    v_to   := nullif(item->>'to', '')::timestamptz;

    case item->>'counter'
      when 'appointments_total' then
        select count(*) into v_count from appointments
          where salon_id = p_salon_id
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'customers_active' then
        select count(*) into v_count from customers
          where salon_id = p_salon_id and is_active = true
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'employees_active' then
        select count(*) into v_count from employees
          where salon_id = p_salon_id and is_active = true
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'login_users_total' then
        select count(*) into v_count from profiles
          where salon_id = p_salon_id and is_active = true
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'services_active' then
        select count(*) into v_count from services
          where salon_id = p_salon_id and is_active = true
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'retail_sales_total' then
        select count(*) into v_count from retail_sales
          where salon_id = p_salon_id
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'inventory_products_active' then
        select count(*) into v_count from inventory_products
          where salon_id = p_salon_id and is_active = true
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'inventory_movements_total' then
        select count(*) into v_count from inventory_movements
          where salon_id = p_salon_id
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'expenses_total' then
        select count(*) into v_count from expenses
          where salon_id = p_salon_id
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      else
        v_count := 0;
    end case;

    result := result || jsonb_build_object(item->>'key', v_count);
  end loop;

  return result;
end $function$;

CREATE OR REPLACE FUNCTION public.create_appointment(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_appt_id uuid;
  v_item jsonb;
  v_salon uuid := public.salon_id();
  v_customer uuid;
  v_has_customer boolean := nullif(payload ->> 'customer_id', '') is not null;
  v_has_new boolean := jsonb_typeof(payload -> 'new_customer') is not null
    and jsonb_typeof(payload -> 'new_customer') <> 'null';
  v_service_id uuid;
  v_employee_id uuid;
  v_service_category uuid;
  v_service_duration int;
  v_service_price numeric(10,2);
  v_start timestamptz;
  v_end timestamptz;
  v_first_start timestamptz;
  v_last_end timestamptz;
  v_expected_start timestamptz;
  v_item_count int;
  v_timezone text;
  v_min_duration int;
  v_allow_off_hours boolean;
  v_global_duration numeric;
  v_local_start timestamp;
  v_local_end timestamp;
  v_day_of_week int;
  v_is_open boolean;
  v_open_time time;
  v_close_time time;
  v_idem_key uuid := nullif(payload ->> 'idempotency_key', '')::uuid;
  v_replay jsonb;
begin
  if v_salon is null then
    raise exception 'No autenticado';
  end if;

  if not public.has_permission('appointments.manage') then
    raise exception 'Sin permiso para crear citas';
  end if;

  if v_has_customer = v_has_new then
    raise exception 'Indica un cliente existente o un cliente nuevo, no ambos ni ninguno.' using errcode = '22023';
  end if;

  if v_has_new then
    if jsonb_typeof(payload -> 'new_customer') <> 'object' then
      raise exception 'Cliente nuevo inválido.' using errcode = '22023';
    end if;
    if not public.has_permission('customers.manage') then
      raise exception 'Sin permiso para crear clientes';
    end if;
  end if;

  -- Idempotencia: el hash cubre todo el payload salvo la propia clave (incluido new_customer).
  if v_idem_key is not null then
    v_replay := public.idempotency_begin(
      'create_appointment',
      v_idem_key,
      encode(sha256(convert_to((payload - 'idempotency_key')::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return (v_replay ->> 'appointment_id')::uuid;
    end if;
  end if;

  select
    s.timezone,
    s.min_appointment_duration_minutes,
    s.allow_off_hours_bookings
  into
    v_timezone,
    v_min_duration,
    v_allow_off_hours
  from salons s
  where s.id = v_salon
    and s.is_active = true;

  if v_timezone is null then
    raise exception 'Salón inválido o suspendido';
  end if;

  if payload -> 'items' is null
    or jsonb_typeof(payload -> 'items') <> 'array'
    or jsonb_array_length(payload -> 'items') = 0
  then
    raise exception 'Selecciona al menos un servicio';
  end if;

  v_item_count := 0;
  for v_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    v_start := (v_item ->> 'start_time')::timestamptz;
    v_end := (v_item ->> 'end_time')::timestamptz;

    if v_end <= v_start then
      raise exception 'El fin del servicio debe ser posterior al inicio';
    end if;

    if v_item_count = 0 then
      v_first_start := v_start;
      v_expected_start := v_start;
    elsif v_start <> v_expected_start then
      raise exception 'Los servicios de la cita deben ser secuenciales';
    end if;

    v_last_end := v_end;
    v_expected_start := v_end;
    v_item_count := v_item_count + 1;
  end loop;

  v_global_duration := extract(epoch from (v_last_end - v_first_start)) / 60;
  if v_global_duration < v_min_duration then
    raise exception 'La duración mínima es % minutos', v_min_duration;
  end if;

  if not v_allow_off_hours then
    v_local_start := v_first_start at time zone v_timezone;
    v_local_end := v_last_end at time zone v_timezone;

    if v_local_end::date <> v_local_start::date then
      raise exception 'El horario está fuera del horario de atención del salón';
    end if;

    v_day_of_week := extract(isodow from v_local_start)::int - 1;

    select h.is_open, h.open_time, h.close_time
      into v_is_open, v_open_time, v_close_time
    from salon_business_hours h
    where h.salon_id = v_salon
      and h.day_of_week = v_day_of_week;

    if not found then
      v_is_open := v_day_of_week between 0 and 5;
      v_open_time := time '08:00';
      v_close_time := time '18:00';
    end if;

    if not v_is_open or v_open_time is null or v_close_time is null then
      raise exception 'El salón está cerrado ese día';
    end if;

    if v_local_start::time < v_open_time or v_local_end::time > v_close_time then
      raise exception 'El horario está fuera del horario de atención del salón';
    end if;
  end if;

  -- Cliente: el existente (validado) o el nuevo, resuelto en esta misma transaccion.
  if v_has_new then
    v_customer := public.resolve_new_customer(v_salon, payload -> 'new_customer');
  else
    v_customer := (payload ->> 'customer_id')::uuid;
    if not exists (
      select 1 from customers c
      where c.id = v_customer
        and c.salon_id = v_salon
        and (c.is_active = true or c.is_temporary = true)
    ) then
      raise exception 'Cliente inválido para este salón';
    end if;
  end if;

  insert into appointments (salon_id, customer_id, created_by, notes, status)
  values (v_salon, v_customer, auth.uid(), coalesce(payload ->> 'notes', ''), 'scheduled')
  returning id into v_appt_id;

  for v_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    v_service_id := (v_item ->> 'service_id')::uuid;
    v_employee_id := (v_item ->> 'employee_id')::uuid;
    v_start := (v_item ->> 'start_time')::timestamptz;
    v_end := (v_item ->> 'end_time')::timestamptz;

    select s.category_id, s.duration_minutes, s.price
      into v_service_category, v_service_duration, v_service_price
    from services s
    where s.id = v_service_id
      and s.salon_id = v_salon
      and s.is_active = true;

    if v_service_category is null then
      raise exception 'Servicio inválido para este salón';
    end if;

    if not exists (
      select 1 from employees e
      where e.id = v_employee_id
        and e.salon_id = v_salon
        and e.is_active = true
    ) then
      raise exception 'Colaborador inválido para este salón';
    end if;

    if not exists (
      select 1 from employee_services es
      where es.salon_id = v_salon
        and es.employee_id = v_employee_id
        and es.service_id = v_service_id
    ) then
      raise exception 'El colaborador no realiza este servicio';
    end if;

    if not exists (
      select 1 from employee_categories ec
      where ec.salon_id = v_salon
        and ec.employee_id = v_employee_id
        and ec.category_id = v_service_category
    ) then
      raise exception 'El colaborador no atiende esta categoría';
    end if;

    if extract(epoch from (v_end - v_start)) / 60 <> v_service_duration then
      raise exception 'La duración del ítem no coincide con el servicio';
    end if;

    insert into appointment_items (
      salon_id, appointment_id, service_id, employee_id,
      start_time, end_time, duration_minutes, price,
      ordering, blocks_calendar
    ) values (
      v_salon,
      v_appt_id,
      v_service_id,
      v_employee_id,
      v_start,
      v_end,
      v_service_duration,
      v_service_price,
      (v_item ->> 'ordering')::int,
      true
    );
  end loop;

  if v_idem_key is not null then
    perform public.idempotency_finish(
      'create_appointment',
      v_idem_key,
      jsonb_build_object('appointment_id', v_appt_id)
    );
  end if;

  return v_appt_id;
end $function$;

CREATE OR REPLACE FUNCTION public.create_inventory_product_with_stock(p_salon_id uuid, p_name text, p_category text, p_cost_price numeric, p_sale_price numeric, p_is_retail_enabled boolean, p_retail_quantity numeric, p_retail_minimum numeric, p_internal_quantity numeric, p_internal_minimum numeric, p_storage_quantity numeric, p_storage_minimum numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_salon uuid := public.salon_id();
  v_product uuid;
begin
  if p_salon_id is distinct from v_salon then
    raise exception 'No tienes acceso a este salón.' using errcode = '42501';
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
    raise exception 'Las cantidades y los mínimos no pueden ser negativos.' using errcode = '22023';
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
$function$;

CREATE OR REPLACE FUNCTION public.enforce_employee_schedule_exception()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_timezone text;
  v_local_date date;
begin
  if not new.blocks_calendar then
    return new;
  end if;

  select timezone
    into v_timezone
  from public.salons
  where id = new.salon_id;

  v_local_date := (
    new.start_time at time zone coalesce(v_timezone, 'America/Panama')
  )::date;

  if exists (
    select 1
    from public.schedule_exceptions
    where salon_id = new.salon_id
      and employee_id = new.employee_id
      and exception_date = v_local_date
  ) then
    raise exception 'El profesional tiene el día libre en esa fecha'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.idempotency_begin(p_procedure text, p_key uuid, p_request_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_row public.idempotency_keys%rowtype;
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if p_procedure is null or p_key is null or p_request_hash is null then
    raise exception 'Clave de idempotencia inválida.' using errcode = '22023';
  end if;

  -- Serializa solicitudes con la misma clave. El lock de transaccion se libera al cerrar la RPC.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_procedure || p_key::text, 0));

  -- Limpieza acotada: como mucho 100 claves con mas de 7 dias por llamada.
  delete from public.idempotency_keys
  where (user_id, procedure, idempotency_key) in (
    select k.user_id, k.procedure, k.idempotency_key
    from public.idempotency_keys k
    where k.created_at < now() - interval '7 days'
    order by k.created_at
    limit 100
  );

  select * into v_row
  from public.idempotency_keys
  where user_id = v_user
    and procedure = p_procedure
    and idempotency_key = p_key;

  if not found then
    insert into public.idempotency_keys (user_id, procedure, idempotency_key, request_hash)
    values (v_user, p_procedure, p_key, p_request_hash);
    return null;
  end if;

  if v_row.request_hash <> p_request_hash then
    raise exception 'Esta solicitud ya se usó con otros datos.' using errcode = '22023';
  end if;

  if v_row.completed_at is not null then
    return v_row.result;
  end if;

  -- Fila reservada pero sin terminar (no deberia ocurrir: begin y finish van en la misma transaccion).
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.idempotency_finish(p_procedure text, p_key uuid, p_result jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  update public.idempotency_keys
  set result = p_result,
      completed_at = now()
  where user_id = v_user
    and procedure = p_procedure
    and idempotency_key = p_key
    and completed_at is null;

  if not found then
    raise exception 'La clave de idempotencia no está reservada.' using errcode = 'P0001';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_inventory_purchase(p_salon_id uuid, p_supplier_name text, p_purchase_date date, p_product_id uuid, p_quantity numeric, p_unit_cost numeric, p_note text DEFAULT NULL::text, p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_purchase_id uuid;
  v_current_quantity numeric;
  v_quantity_after numeric;
  v_total_cost numeric;
  v_replay jsonb;
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salón.' using errcode = '42501';
  end if;

  if not public.has_permission('inventory.manage') then
    raise exception 'No tienes permiso para registrar compras de inventario.' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    v_replay := public.idempotency_begin(
      'record_inventory_purchase',
      p_idempotency_key,
      encode(sha256(convert_to(jsonb_build_object(
        'salon_id', p_salon_id,
        'supplier_name', coalesce(p_supplier_name, ''),
        'purchase_date', p_purchase_date,
        'product_id', p_product_id,
        'quantity', p_quantity,
        'unit_cost', p_unit_cost,
        'note', coalesce(p_note, '')
      )::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return (v_replay ->> 'purchase_id')::uuid;
    end if;
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
    raise exception 'Producto inválido.' using errcode = '22023';
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

  if p_idempotency_key is not null then
    perform public.idempotency_finish(
      'record_inventory_purchase',
      p_idempotency_key,
      jsonb_build_object('purchase_id', v_purchase_id)
    );
  end if;

  return v_purchase_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_inventory_transfer(p_salon_id uuid, p_product_id uuid, p_from_location text, p_to_location text, p_quantity numeric, p_note text DEFAULT NULL::text, p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_from_quantity numeric;
  v_to_quantity numeric;
  v_from_after numeric;
  v_to_after numeric;
  v_reference_id uuid := gen_random_uuid();
  v_replay jsonb;
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salón.' using errcode = '42501';
  end if;

  if not public.has_permission('inventory.manage') then
    raise exception 'No tienes permiso para gestionar inventario.' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    v_replay := public.idempotency_begin(
      'record_inventory_transfer',
      p_idempotency_key,
      encode(sha256(convert_to(jsonb_build_object(
        'salon_id', p_salon_id,
        'product_id', p_product_id,
        'from_location', p_from_location,
        'to_location', p_to_location,
        'quantity', p_quantity,
        'note', coalesce(p_note, '')
      )::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return;
    end if;
  end if;

  if p_from_location not in ('retail', 'internal', 'storage') or p_to_location not in ('retail', 'internal', 'storage') then
    raise exception 'Ubicación de inventario inválida.' using errcode = '22023';
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
    raise exception 'Producto inválido.' using errcode = '22023';
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

  if p_idempotency_key is not null then
    perform public.idempotency_finish('record_inventory_transfer', p_idempotency_key, jsonb_build_object('ok', true));
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_plan_alert(p_plan_id uuid, p_metric_key text, p_module_key text, p_severity text, p_message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_salon uuid := public.salon_id();
  v_id uuid;
begin
  if v_salon is null then
    raise exception 'La sesión no tiene salón' using errcode = '42501';
  end if;

  insert into salon_plan_alerts (salon_id, plan_id, metric_key, module_key, severity, message)
  values (v_salon, p_plan_id, p_metric_key, p_module_key, p_severity, p_message)
  returning id into v_id;

  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.record_retail_sale(p_salon_id uuid, p_customer_id uuid, p_product_id uuid, p_location text, p_quantity numeric, p_unit_price numeric, p_payment_method text, p_note text DEFAULT NULL::text, p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_sale_id uuid;
  v_current_quantity numeric;
  v_quantity_after numeric;
  v_total_amount numeric;
  v_payment_method text;
  v_replay jsonb;
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salón.' using errcode = '42501';
  end if;

  if not public.has_permission('retail.manage') then
    raise exception 'No tienes permiso para gestionar vitrina.' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    v_replay := public.idempotency_begin(
      'record_retail_sale',
      p_idempotency_key,
      encode(sha256(convert_to(jsonb_build_object(
        'salon_id', p_salon_id,
        'customer_id', p_customer_id,
        'product_id', p_product_id,
        'location', p_location,
        'quantity', p_quantity,
        'unit_price', p_unit_price,
        'payment_method', p_payment_method,
        'note', coalesce(p_note, '')
      )::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return (v_replay ->> 'sale_id')::uuid;
    end if;
  end if;

  if p_location not in ('retail', 'internal', 'storage') then
    raise exception 'Ubicación de inventario inválida.' using errcode = '22023';
  end if;

  v_payment_method := nullif(trim(coalesce(p_payment_method, '')), '');
  if v_payment_method is null or length(v_payment_method) > 64 then
    raise exception 'Método de pago inválido.' using errcode = '22023';
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
    raise exception 'Cliente inválido.' using errcode = '22023';
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
    raise exception 'Este producto no está habilitado para venta en vitrina.' using errcode = '22023';
  end if;

  select quantity
    into v_current_quantity
  from public.inventory_stock_locations
  where salon_id = p_salon_id
    and product_id = p_product_id
    and location = p_location
  for update;

  if not found then
    raise exception 'No existe stock para esa ubicación.' using errcode = '22023';
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

  if p_idempotency_key is not null then
    perform public.idempotency_finish(
      'record_retail_sale',
      p_idempotency_key,
      jsonb_build_object('sale_id', v_sale_id)
    );
  end if;

  return v_sale_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_new_customer(p_salon uuid, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_first text := btrim(coalesce(p_data ->> 'first_name', ''));
  v_last text := btrim(coalesce(p_data ->> 'last_name', ''));
  v_phone text := nullif(btrim(coalesce(p_data ->> 'phone', '')), '');
  v_existing public.customers%rowtype;
  v_id uuid;
begin
  if v_first = '' then
    raise exception 'El nombre es obligatorio' using errcode = '22023';
  end if;
  if char_length(v_first) > 100 then
    raise exception 'El nombre no puede superar 100 caracteres' using errcode = '22023';
  end if;
  if v_last = '' then
    raise exception 'El apellido es obligatorio' using errcode = '22023';
  end if;
  if char_length(v_last) > 100 then
    raise exception 'El apellido no puede superar 100 caracteres' using errcode = '22023';
  end if;
  if v_phone is not null and char_length(v_phone) > 30 then
    raise exception 'El teléfono no puede superar 30 caracteres' using errcode = '22023';
  end if;

  if v_phone is not null then
    select * into v_existing
    from public.customers c
    where c.salon_id = p_salon
      and c.phone = v_phone;

    if found then
      if v_existing.is_temporary then
        update public.customers
        set first_name = v_first,
            last_name = v_last
        where id = v_existing.id;
        return v_existing.id;
      end if;

      if v_existing.is_active then
        return v_existing.id;
      end if;

      raise exception 'Este cliente no está disponible para nuevas citas. Restáuralo desde Clientes para conservar su historial.'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.customers (salon_id, first_name, last_name, phone, is_temporary, is_active)
  values (p_salon, v_first, v_last, v_phone, true, false)
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_appointment(payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_appt_id uuid := (payload ->> 'appointment_id')::uuid;
  v_item jsonb;
  v_salon uuid := public.salon_id();
  v_status text;
  v_service_id uuid;
  v_employee_id uuid;
  v_service_category uuid;
  v_service_duration int;
  v_service_price numeric(10,2);
  v_start timestamptz;
  v_end timestamptz;
  v_first_start timestamptz;
  v_last_end timestamptz;
  v_expected_start timestamptz;
  v_item_count int;
  v_timezone text;
  v_min_duration int;
  v_allow_off_hours boolean;
  v_global_duration numeric;
  v_local_start timestamp;
  v_local_end timestamp;
  v_day_of_week int;
  v_is_open boolean;
  v_open_time time;
  v_close_time time;
  v_idem_key uuid := nullif(payload ->> 'idempotency_key', '')::uuid;
  v_replay jsonb;
begin
  if v_salon is null then
    raise exception 'No autenticado';
  end if;

  if not public.has_permission('appointments.manage') then
    raise exception 'Sin permiso para editar citas';
  end if;

  if v_idem_key is not null then
    v_replay := public.idempotency_begin(
      'update_appointment',
      v_idem_key,
      encode(sha256(convert_to((payload - 'idempotency_key')::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return;
    end if;
  end if;

  select a.status
    into v_status
  from appointments a
  where a.id = v_appt_id
    and a.salon_id = v_salon
  for update;

  if v_status is null then
    raise exception 'Cita inválida para este salón';
  end if;

  if v_status in ('completed', 'cancelled', 'no_show') then
    raise exception 'Esta cita ya está cerrada y no se puede editar';
  end if;

  select
    s.timezone,
    s.min_appointment_duration_minutes,
    s.allow_off_hours_bookings
  into
    v_timezone,
    v_min_duration,
    v_allow_off_hours
  from salons s
  where s.id = v_salon
    and s.is_active = true;

  if v_timezone is null then
    raise exception 'Salón inválido o suspendido';
  end if;

  if payload -> 'items' is null
    or jsonb_typeof(payload -> 'items') <> 'array'
    or jsonb_array_length(payload -> 'items') = 0
  then
    raise exception 'Selecciona al menos un servicio';
  end if;

  v_item_count := 0;
  for v_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    v_start := (v_item ->> 'start_time')::timestamptz;
    v_end := (v_item ->> 'end_time')::timestamptz;

    if v_end <= v_start then
      raise exception 'El fin del servicio debe ser posterior al inicio';
    end if;

    if v_item_count = 0 then
      v_first_start := v_start;
      v_expected_start := v_start;
    elsif v_start <> v_expected_start then
      raise exception 'Los servicios de la cita deben ser secuenciales';
    end if;

    v_last_end := v_end;
    v_expected_start := v_end;
    v_item_count := v_item_count + 1;
  end loop;

  v_global_duration := extract(epoch from (v_last_end - v_first_start)) / 60;
  if v_global_duration < v_min_duration then
    raise exception 'La duración mínima es % minutos', v_min_duration;
  end if;

  if not v_allow_off_hours then
    v_local_start := v_first_start at time zone v_timezone;
    v_local_end := v_last_end at time zone v_timezone;

    if v_local_end::date <> v_local_start::date then
      raise exception 'El horario está fuera del horario de atención del salón';
    end if;

    v_day_of_week := extract(isodow from v_local_start)::int - 1;

    select h.is_open, h.open_time, h.close_time
      into v_is_open, v_open_time, v_close_time
    from salon_business_hours h
    where h.salon_id = v_salon
      and h.day_of_week = v_day_of_week;

    if not found then
      v_is_open := v_day_of_week between 0 and 5;
      v_open_time := time '08:00';
      v_close_time := time '18:00';
    end if;

    if not v_is_open or v_open_time is null or v_close_time is null then
      raise exception 'El salón está cerrado ese día';
    end if;

    if v_local_start::time < v_open_time or v_local_end::time > v_close_time then
      raise exception 'El horario está fuera del horario de atención del salón';
    end if;
  end if;

  update appointments
    set notes = coalesce(payload ->> 'notes', '')
  where id = v_appt_id
    and salon_id = v_salon;

  delete from appointment_items
  where appointment_id = v_appt_id
    and salon_id = v_salon;

  for v_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    v_service_id := (v_item ->> 'service_id')::uuid;
    v_employee_id := (v_item ->> 'employee_id')::uuid;
    v_start := (v_item ->> 'start_time')::timestamptz;
    v_end := (v_item ->> 'end_time')::timestamptz;

    select s.category_id, s.duration_minutes, s.price
      into v_service_category, v_service_duration, v_service_price
    from services s
    where s.id = v_service_id
      and s.salon_id = v_salon
      and s.is_active = true;

    if v_service_category is null then
      raise exception 'Servicio inválido para este salón';
    end if;

    if not exists (
      select 1 from employees e
      where e.id = v_employee_id
        and e.salon_id = v_salon
        and e.is_active = true
    ) then
      raise exception 'Colaborador inválido para este salón';
    end if;

    if not exists (
      select 1 from employee_services es
      where es.salon_id = v_salon
        and es.employee_id = v_employee_id
        and es.service_id = v_service_id
    ) then
      raise exception 'El colaborador no realiza este servicio';
    end if;

    if not exists (
      select 1 from employee_categories ec
      where ec.salon_id = v_salon
        and ec.employee_id = v_employee_id
        and ec.category_id = v_service_category
    ) then
      raise exception 'El colaborador no atiende esta categoría';
    end if;

    if extract(epoch from (v_end - v_start)) / 60 <> v_service_duration then
      raise exception 'La duración del ítem no coincide con el servicio';
    end if;

    insert into appointment_items (
      salon_id, appointment_id, service_id, employee_id,
      start_time, end_time, duration_minutes, price,
      ordering, blocks_calendar
    ) values (
      v_salon,
      v_appt_id,
      v_service_id,
      v_employee_id,
      v_start,
      v_end,
      v_service_duration,
      v_service_price,
      (v_item ->> 'ordering')::int,
      true
    );
  end loop;

  if v_idem_key is not null then
    perform public.idempotency_finish('update_appointment', v_idem_key, jsonb_build_object('ok', true));
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.update_inventory_product_profile(p_salon_id uuid, p_product_id uuid, p_name text, p_category text, p_cost_price numeric, p_sale_price numeric, p_is_retail_enabled boolean, p_is_active boolean, p_retail_minimum numeric, p_internal_minimum numeric, p_storage_minimum numeric)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_salon uuid := public.salon_id();
begin
  if p_salon_id is distinct from v_salon then
    raise exception 'No tienes acceso a este salón.' using errcode = '42501';
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
    raise exception 'Los mínimos no pueden ser negativos.' using errcode = '22023';
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
$function$;

commit;
