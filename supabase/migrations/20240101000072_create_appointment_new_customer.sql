-- F03-4: cliente nuevo y cita en una sola transaccion.
--
-- Antes, el asistente de citas llamaba primero a findOrCreateCustomer (crea el cliente) y
-- despues a create_appointment. Si la cita fallaba (solape, validacion, red) quedaba un cliente huerfano.
--
-- Forward-only, expand/contract: las llamadas con customer_id siguen identicas.
--   * create_appointment(jsonb) acepta, en lugar de customer_id, payload->'new_customer'
--     con first_name, last_name y phone (opcional). Exactamente uno de los dos (si no, 22023).
--   * public.resolve_new_customer(salon, datos): helper interno (sin EXECUTE para clientes).
--     Reutiliza el cliente del salon con ese telefono (activo, o temporal al que actualiza el nombre)
--     o crea un cliente temporal inactivo, con las mismas reglas que el alta temporal de la app.
--   * Todo ocurre dentro de la misma llamada: si la cita falla, el cliente nuevo tampoco se crea.
--   * La clave de idempotencia cubre el payload completo (incluido new_customer): un reenvio
--     devuelve la misma cita y no crea un segundo cliente.
--   * Se conserva el tipo de retorno uuid (id de la cita): cambiarlo rompe a los consumidores.
--     Por eso el id del cliente no se devuelve; el cliente se puede consultar por la cita.

-- Bloqueos cortos, como en el resto de migraciones con DDL.
set lock_timeout = '2s';
set statement_timeout = '30s';

-- 1. Helper interno: resuelve o crea el cliente nuevo del salon.
create or replace function public.resolve_new_customer(p_salon uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    raise exception 'El telefono no puede superar 30 caracteres' using errcode = '22023';
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

      raise exception 'Este cliente no esta disponible para nuevas citas. Restauralo desde Clientes para conservar su historial.'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.customers (salon_id, first_name, last_name, phone, is_temporary, is_active)
  values (p_salon, v_first, v_last, v_phone, true, false)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.resolve_new_customer(uuid, jsonb) from public, anon, authenticated, service_role;

-- 2. create_appointment(jsonb): cuerpo vigente (migracion 065) + cliente nuevo.
create or replace function public.create_appointment(payload jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
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
      raise exception 'Cliente nuevo invalido.' using errcode = '22023';
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
      raise exception 'Cliente invalido para este salon';
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

revoke all on function public.create_appointment(jsonb) from public, anon;
grant execute on function public.create_appointment(jsonb) to authenticated;
