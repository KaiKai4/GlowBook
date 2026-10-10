-- update_appointment(jsonb): permitir conservar un servicio ya asignado aunque este desactivado.
--
-- Problema: la app (src/features/appointments/domain/scheduling.ts, allowedInactiveServiceIds) deja editar
-- una cita conservando un servicio que despues se desactivo, pero la RPC filtraba `s.is_active = true`
-- en el bucle de items y rechazaba ese servicio con "Servicio inválido para este salón".
--
-- Solucion: se acepta un servicio inactivo solo si ya estaba asignado a ESTA cita. Los ids previos se
-- capturan ANTES de borrar los items (el delete de la cita los elimina), y se comparan despues.
-- Un servicio inactivo que la cita no tenia sigue rechazado.
--
-- Resto de la funcion sin cambios: firma, security definer, search_path, mensajes, validaciones e
-- idempotencia. create or replace conserva los grants existentes de la migracion 078.
--
-- Forward-only: redefine la funcion vigente (migracion 078).

set lock_timeout = '2s';
set statement_timeout = '30s';

begin;

create or replace function public.update_appointment(payload jsonb)
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
  v_previous_service_ids uuid[];
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

  -- Servicios que la cita ya tenia: se capturan antes del delete de items
  select coalesce(array_agg(ai.service_id), '{}'::uuid[])
    into v_previous_service_ids
  from appointment_items ai
  where ai.appointment_id = v_appt_id
    and ai.salon_id = v_salon;

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
      and (
        s.is_active = true
        or s.id = any (v_previous_service_ids)
      );

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


commit;
