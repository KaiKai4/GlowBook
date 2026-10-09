-- Fase 4: idempotencia de escrituras criticas y transiciones atomicas de cita.
--
-- Forward-only, expand/contract: la app anterior sigue funcionando sin cambios.
--   * public.idempotency_keys: claves de idempotencia por (usuario, procedimiento, clave).
--     RLS activado SIN politicas y sin grants de cliente. Solo lo tocan funciones internas.
--   * idempotency_begin / idempotency_finish: funciones internas (sin EXECUTE para clientes).
--   * create_appointment(jsonb) y update_appointment(jsonb): la clave viaja en
--     payload->>'idempotency_key' (misma firma).
--   * record_retail_sale, record_inventory_purchase, record_inventory_transfer: se recrean
--     con parametro final p_idempotency_key uuid default null (las llamadas actuales siguen valiendo).
--   * confirm_appointment, complete_appointment, cancel_appointment, mark_no_show: RPC nuevas, atomicas
--     (cabecera + items, bloqueo FOR UPDATE y guarda de transicion), con la clave en
--     payload->>'idempotency_key'. complete_appointment promueve el cliente temporal en la misma transaccion.
--   * appointment_reminder_log.idempotency_key: columna nullable + indice unico parcial.
--
-- Sin clave, cada RPC se comporta exactamente como antes.

-- Bloqueos cortos: las operaciones DDL no deben esperar indefinidamente a locks de tabla.
set lock_timeout = '2s';
set statement_timeout = '30s';

begin;

-- 1. Privilegios por defecto: las funciones nuevas de public no nacen ejecutables por
--    authenticated ni service_role. Cada RPC concede EXECUTE de forma explicita mas abajo.
alter default privileges in schema public revoke execute on functions from authenticated, service_role;

-- 2. Tabla de claves de idempotencia. RLS sin politicas + sin grants: solo funciones internas.
create table if not exists public.idempotency_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  procedure text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, procedure, idempotency_key)
);

alter table public.idempotency_keys enable row level security;
revoke all on public.idempotency_keys from public, anon, authenticated, service_role;

create index if not exists idempotency_keys_created_at_idx
  on public.idempotency_keys (created_at);

-- 3. Funciones internas de idempotencia (sin EXECUTE para roles cliente).

-- Reserva la clave para el usuario autenticado.
-- Devuelve el resultado guardado si la solicitud ya termino con el mismo hash;
-- devuelve null si la RPC debe ejecutarse (la clave queda reservada en la misma transaccion).
create or replace function public.idempotency_begin(
  p_procedure text,
  p_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.idempotency_keys%rowtype;
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if p_procedure is null or p_key is null or p_request_hash is null then
    raise exception 'Clave de idempotencia invalida.' using errcode = '22023';
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
$$;

-- Marca la clave como completada y guarda el resultado que devuelve la RPC.
create or replace function public.idempotency_finish(
  p_procedure text,
  p_key uuid,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    raise exception 'La clave de idempotencia no esta reservada.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.idempotency_begin(text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.idempotency_finish(text, uuid, jsonb) from public, anon, authenticated, service_role;

-- 4. create_appointment(jsonb): misma semantica que la migracion 030, con clave opcional.
-- Resultado guardado: {"appointment_id": "<uuid>"}.
create or replace function create_appointment(payload jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_appt_id uuid;
  v_item jsonb;
  v_salon uuid := public.salon_id();
  v_customer uuid := (payload ->> 'customer_id')::uuid;
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

  -- Idempotencia: el hash cubre todo el payload salvo la propia clave.
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
    raise exception 'Salon invalido o suspendido';
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
    raise exception 'La duracion minima es % minutos', v_min_duration;
  end if;

  if not v_allow_off_hours then
    v_local_start := v_first_start at time zone v_timezone;
    v_local_end := v_last_end at time zone v_timezone;

    if v_local_end::date <> v_local_start::date then
      raise exception 'El horario esta fuera del horario de atencion del salon';
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
      raise exception 'El salon esta cerrado ese dia';
    end if;

    if v_local_start::time < v_open_time or v_local_end::time > v_close_time then
      raise exception 'El horario esta fuera del horario de atencion del salon';
    end if;
  end if;

  if not exists (
    select 1 from customers c
    where c.id = v_customer
      and c.salon_id = v_salon
      and (c.is_active = true or c.is_temporary = true)
  ) then
    raise exception 'Cliente invalido para este salon';
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
      raise exception 'Servicio invalido para este salon';
    end if;

    if not exists (
      select 1 from employees e
      where e.id = v_employee_id
        and e.salon_id = v_salon
        and e.is_active = true
    ) then
      raise exception 'Colaborador invalido para este salon';
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
      raise exception 'El colaborador no atiende esta categoria';
    end if;

    if extract(epoch from (v_end - v_start)) / 60 <> v_service_duration then
      raise exception 'La duracion del item no coincide con el servicio';
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
end $$;

-- 5. update_appointment(jsonb): misma semantica que la migracion 030, con clave opcional.
-- Resultado guardado: {"ok": true}. La firma sigue siendo void (no se puede cambiar el tipo de retorno).
create or replace function update_appointment(payload jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
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
    raise exception 'Cita invalida para este salon';
  end if;

  if v_status in ('completed', 'cancelled', 'no_show') then
    raise exception 'Esta cita ya esta cerrada y no se puede editar';
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
    raise exception 'Salon invalido o suspendido';
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
    raise exception 'La duracion minima es % minutos', v_min_duration;
  end if;

  if not v_allow_off_hours then
    v_local_start := v_first_start at time zone v_timezone;
    v_local_end := v_last_end at time zone v_timezone;

    if v_local_end::date <> v_local_start::date then
      raise exception 'El horario esta fuera del horario de atencion del salon';
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
      raise exception 'El salon esta cerrado ese dia';
    end if;

    if v_local_start::time < v_open_time or v_local_end::time > v_close_time then
      raise exception 'El horario esta fuera del horario de atencion del salon';
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
      raise exception 'Servicio invalido para este salon';
    end if;

    if not exists (
      select 1 from employees e
      where e.id = v_employee_id
        and e.salon_id = v_salon
        and e.is_active = true
    ) then
      raise exception 'Colaborador invalido para este salon';
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
      raise exception 'El colaborador no atiende esta categoria';
    end if;

    if extract(epoch from (v_end - v_start)) / 60 <> v_service_duration then
      raise exception 'La duracion del item no coincide con el servicio';
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
end $$;

-- 6. record_retail_sale: se recrea con p_idempotency_key al final. Misma semantica que la 044.
-- Resultado guardado: {"sale_id": "<uuid>"}.
-- Justificado: la firma cambia (parametro final p_idempotency_key con default null) y la misma
-- migracion vuelve a crear la funcion con la firma nueva; las llamadas con nombre siguen valiendo.
drop function if exists public.record_retail_sale(uuid, uuid, uuid, text, numeric, numeric, text, text);

create or replace function public.record_retail_sale(
  p_salon_id uuid,
  p_customer_id uuid,
  p_product_id uuid,
  p_location text,
  p_quantity numeric,
  p_unit_price numeric,
  p_payment_method text,
  p_note text default null,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale_id uuid;
  v_current_quantity numeric;
  v_quantity_after numeric;
  v_total_amount numeric;
  v_payment_method text;
  v_replay jsonb;
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salon.' using errcode = '42501';
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

  if p_idempotency_key is not null then
    perform public.idempotency_finish(
      'record_retail_sale',
      p_idempotency_key,
      jsonb_build_object('sale_id', v_sale_id)
    );
  end if;

  return v_sale_id;
end;
$$;

revoke all on function public.record_retail_sale(uuid, uuid, uuid, text, numeric, numeric, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.record_retail_sale(uuid, uuid, uuid, text, numeric, numeric, text, text, uuid)
  to authenticated;

-- 7. record_inventory_purchase: se recrea con p_idempotency_key al final. Misma semantica que la 043.
-- Resultado guardado: {"purchase_id": "<uuid>"}.
-- Justificado: la firma cambia (parametro final p_idempotency_key con default null) y la misma
-- migracion vuelve a crear la funcion con la firma nueva; las llamadas con nombre siguen valiendo.
drop function if exists public.record_inventory_purchase(uuid, text, date, uuid, numeric, numeric, text);

create or replace function public.record_inventory_purchase(
  p_salon_id uuid,
  p_supplier_name text,
  p_purchase_date date,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_note text default null,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_purchase_id uuid;
  v_current_quantity numeric;
  v_quantity_after numeric;
  v_total_cost numeric;
  v_replay jsonb;
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salon.' using errcode = '42501';
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

  if p_idempotency_key is not null then
    perform public.idempotency_finish(
      'record_inventory_purchase',
      p_idempotency_key,
      jsonb_build_object('purchase_id', v_purchase_id)
    );
  end if;

  return v_purchase_id;
end;
$$;

revoke all on function public.record_inventory_purchase(uuid, text, date, uuid, numeric, numeric, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.record_inventory_purchase(uuid, text, date, uuid, numeric, numeric, text, uuid)
  to authenticated;

-- 8. record_inventory_transfer: se recrea con p_idempotency_key al final. Misma semantica que la 043.
-- Resultado guardado: {"ok": true}.
-- Justificado: la firma cambia (parametro final p_idempotency_key con default null) y la misma
-- migracion vuelve a crear la funcion con la firma nueva; las llamadas con nombre siguen valiendo.
drop function if exists public.record_inventory_transfer(uuid, uuid, text, text, numeric, text);

create or replace function public.record_inventory_transfer(
  p_salon_id uuid,
  p_product_id uuid,
  p_from_location text,
  p_to_location text,
  p_quantity numeric,
  p_note text default null,
  p_idempotency_key uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from_quantity numeric;
  v_to_quantity numeric;
  v_from_after numeric;
  v_to_after numeric;
  v_reference_id uuid := gen_random_uuid();
  v_replay jsonb;
begin
  if p_salon_id is distinct from public.salon_id() then
    raise exception 'No tienes acceso a este salon.' using errcode = '42501';
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

  if p_idempotency_key is not null then
    perform public.idempotency_finish('record_inventory_transfer', p_idempotency_key, jsonb_build_object('ok', true));
  end if;
end;
$$;

revoke all on function public.record_inventory_transfer(uuid, uuid, text, text, numeric, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.record_inventory_transfer(uuid, uuid, text, text, numeric, text, uuid)
  to authenticated;

-- 9. Transiciones atomicas de cita.
-- Semantica igual que src/features/appointments/domain/lifecycle.ts (scheduled|confirmed -> ...)
-- y que los casos de uso complete/cancel-appointment.ts: cabecera e items en la misma transaccion.

-- Cierre sin cobro (cancelled | no_show). Interna: solo la invocan cancel_appointment y mark_no_show.
create or replace function public.close_appointment_without_charge(
  p_appointment_id uuid,
  p_salon_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if p_status not in ('cancelled', 'no_show') then
    raise exception 'Estado de cierre invalido.' using errcode = '22023';
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
$$;

revoke all on function public.close_appointment_without_charge(uuid, uuid, text)
  from public, anon, authenticated, service_role;

-- cancel_appointment(jsonb). Resultado guardado: {"appointment_id", "status": "cancelled"}.
create or replace function public.cancel_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_appt_id uuid := (payload ->> 'appointment_id')::uuid;
  v_idem_key uuid := nullif(payload ->> 'idempotency_key', '')::uuid;
  v_replay jsonb;
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
      'cancel_appointment',
      v_idem_key,
      encode(sha256(convert_to((payload - 'idempotency_key')::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return v_replay;
    end if;
  end if;

  v_result := public.close_appointment_without_charge(v_appt_id, v_salon, 'cancelled');

  if v_idem_key is not null then
    perform public.idempotency_finish('cancel_appointment', v_idem_key, v_result);
  end if;

  return v_result;
end;
$$;

revoke all on function public.cancel_appointment(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.cancel_appointment(jsonb) to authenticated;

-- mark_no_show(jsonb). Resultado guardado: {"appointment_id", "status": "no_show"}.
create or replace function public.mark_no_show(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_appt_id uuid := (payload ->> 'appointment_id')::uuid;
  v_idem_key uuid := nullif(payload ->> 'idempotency_key', '')::uuid;
  v_replay jsonb;
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
      'mark_no_show',
      v_idem_key,
      encode(sha256(convert_to((payload - 'idempotency_key')::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return v_replay;
    end if;
  end if;

  v_result := public.close_appointment_without_charge(v_appt_id, v_salon, 'no_show');

  if v_idem_key is not null then
    perform public.idempotency_finish('mark_no_show', v_idem_key, v_result);
  end if;

  return v_result;
end;
$$;

revoke all on function public.mark_no_show(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.mark_no_show(jsonb) to authenticated;

-- confirm_appointment(jsonb). Unica transicion valida: scheduled -> confirmed.
-- La cita se bloquea (FOR UPDATE) antes de comprobar el estado: una cancelacion concurrente no puede
-- colarse entre la lectura y la escritura. Resultado guardado: {"appointment_id", "status": "confirmed"}.
create or replace function public.confirm_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_appt_id uuid := (payload ->> 'appointment_id')::uuid;
  v_idem_key uuid := nullif(payload ->> 'idempotency_key', '')::uuid;
  v_replay jsonb;
  v_status text;
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
      'confirm_appointment',
      v_idem_key,
      encode(sha256(convert_to((payload - 'idempotency_key')::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return v_replay;
    end if;
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

  if v_status <> 'scheduled' then
    raise exception 'No se puede cambiar el estado de "%" a "%".', v_status, 'confirmed';
  end if;

  update public.appointments
  set status = 'confirmed'
  where id = v_appt_id
    and salon_id = v_salon;

  v_result := jsonb_build_object('appointment_id', v_appt_id, 'status', 'confirmed');

  if v_idem_key is not null then
    perform public.idempotency_finish('confirm_appointment', v_idem_key, v_result);
  end if;

  return v_result;
end;
$$;

revoke all on function public.confirm_appointment(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.confirm_appointment(jsonb) to authenticated;

-- complete_appointment(jsonb).
-- Payload: {appointment_id, payment_method, completion_price_note?, item_charges?: [{id, price, discount_percentage?}],
--           idempotency_key?}. Los items no enviados conservan su precio y pierden descuento (como en la app).
-- Resultado guardado: {"appointment_id", "status": "completed", "subtotal", "discount_amount", "total_price"}.
create or replace function public.complete_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    raise exception 'Metodo de pago invalido.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.salons s, unnest(s.payment_methods) as m(name)
    where s.id = v_salon
      and lower(m.name) = v_method
  ) then
    raise exception 'Ese metodo de pago no esta habilitado para este salon.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_charges) <> 'array' then
    raise exception 'Cobros de servicios invalidos.' using errcode = '22023';
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
$$;

revoke all on function public.complete_appointment(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.complete_appointment(jsonb) to authenticated;

-- 10. Registro de recordatorios: expand. Columna nullable + indice unico parcial.
-- Los duplicados existentes no se tocan (la columna nace a null). La app puede enviar la clave al
-- insertar; un 23505 sobre (salon_id, idempotency_key) significa que el envio ya estaba registrado.
alter table public.appointment_reminder_log
  add column if not exists idempotency_key uuid;

create unique index if not exists appointment_reminder_log_idempotency_key_uidx
  on public.appointment_reminder_log (salon_id, idempotency_key)
  where idempotency_key is not null;

commit;
