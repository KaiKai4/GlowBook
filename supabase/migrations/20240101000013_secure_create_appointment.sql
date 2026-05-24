-- SECURITY FIX: create_appointment was security definer with NO authorization
-- check and trusted the client-supplied salon_id/created_by. Any authenticated
-- user could call it directly (bypassing the app's permission check) to create
-- appointments — even in another salon. This locks it down:
--   * salon is derived from the caller (public.salon_id()), never the payload
--   * requires appointments.manage
--   * created_by is pinned to auth.uid()
--   * customer / service / employee must belong to the caller's salon
create or replace function create_appointment(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_appt_id uuid;
  v_item jsonb;
  v_salon uuid := public.salon_id();
  v_customer uuid := (payload ->> 'customer_id')::uuid;
begin
  if v_salon is null then
    raise exception 'No autenticado';
  end if;
  if not public.has_permission('appointments.manage') then
    raise exception 'Sin permiso para crear citas';
  end if;
  if not exists (
    select 1 from customers c where c.id = v_customer and c.salon_id = v_salon
  ) then
    raise exception 'Cliente invalido para este salon';
  end if;

  insert into appointments (salon_id, customer_id, created_by, notes, status)
  values (v_salon, v_customer, auth.uid(), coalesce(payload ->> 'notes', ''), 'scheduled')
  returning id into v_appt_id;

  for v_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    if not exists (
      select 1 from services s
      where s.id = (v_item ->> 'service_id')::uuid and s.salon_id = v_salon
    ) then
      raise exception 'Servicio invalido para este salon';
    end if;
    if not exists (
      select 1 from employees e
      where e.id = (v_item ->> 'employee_id')::uuid and e.salon_id = v_salon
    ) then
      raise exception 'Colaborador invalido para este salon';
    end if;

    insert into appointment_items (
      salon_id, appointment_id, service_id, employee_id,
      start_time, end_time, duration_minutes, price,
      ordering, blocks_calendar
    ) values (
      v_salon,
      v_appt_id,
      (v_item ->> 'service_id')::uuid,
      (v_item ->> 'employee_id')::uuid,
      (v_item ->> 'start_time')::timestamptz,
      (v_item ->> 'end_time')::timestamptz,
      (v_item ->> 'duration_minutes')::int,
      (v_item ->> 'price')::numeric,
      (v_item ->> 'ordering')::int,
      coalesce((v_item ->> 'blocks_calendar')::boolean, true)
    );
  end loop;

  return v_appt_id;
end $$;
