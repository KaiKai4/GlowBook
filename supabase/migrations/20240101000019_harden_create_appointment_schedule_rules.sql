-- Harden appointment creation so the transactional RPC owns the same invariants
-- as the application use-case. The UI remains helpful, but the database is the
-- final authority for salon schedule, booking notice and global duration.
create or replace function create_appointment(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
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
  v_min_notice int;
  v_min_duration int;
  v_allow_off_hours boolean;
  v_global_duration numeric;
  v_local_start timestamp;
  v_local_end timestamp;
  v_day_of_week int;
  v_is_open boolean;
  v_open_time time;
  v_close_time time;
begin
  if v_salon is null then
    raise exception 'No autenticado';
  end if;

  if not public.has_permission('appointments.manage') then
    raise exception 'Sin permiso para crear citas';
  end if;

  select
    s.timezone,
    s.min_booking_notice_minutes,
    s.min_appointment_duration_minutes,
    s.allow_off_hours_bookings
  into
    v_timezone,
    v_min_notice,
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

  -- First pass: validate the global appointment range before writing anything.
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

  if v_first_start < now() + make_interval(mins => v_min_notice) then
    raise exception 'La cita debe agendarse con al menos % minutos de anticipacion', v_min_notice;
  end if;

  if not v_allow_off_hours then
    v_local_start := v_first_start at time zone v_timezone;
    v_local_end := v_last_end at time zone v_timezone;

    -- Business hours are same-day windows. A range crossing local midnight is
    -- necessarily outside the configured salon day.
    if v_local_end::date <> v_local_start::date then
      raise exception 'El horario esta fuera del horario de atencion del salon';
    end if;

    v_day_of_week := extract(isodow from v_local_start)::int - 1; -- 0=Monday, 6=Sunday

    select h.is_open, h.open_time, h.close_time
      into v_is_open, v_open_time, v_close_time
    from salon_business_hours h
    where h.salon_id = v_salon
      and h.day_of_week = v_day_of_week;

    if not found then
      -- Same fallback as the TypeScript availability module:
      -- Monday-Saturday 08:00-18:00, Sunday closed.
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

  return v_appt_id;
end $$;
