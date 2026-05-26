-- Defense in depth for appointment creation.
-- The UI filters eligible collaborators, and the server use-case validates it,
-- but the privileged RPC must also reject manipulated payloads.
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
begin
  if v_salon is null then
    raise exception 'No autenticado';
  end if;

  if not public.has_permission('appointments.manage') then
    raise exception 'Sin permiso para crear citas';
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
