-- Las excepciones de horario deben ser una regla de base de datos, no solo una
-- validacion de UI. create_appointment y update_appointment son RPCs
-- SECURITY DEFINER y ambas terminan escribiendo appointment_items.
create or replace function public.enforce_employee_schedule_exception()
returns trigger
language plpgsql
set search_path = public
as $$
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
    raise exception 'El profesional tiene el dia libre en esa fecha'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_employee_schedule_exception
  on public.appointment_items;

create trigger trg_enforce_employee_schedule_exception
before insert or update of salon_id, employee_id, start_time, blocks_calendar
on public.appointment_items
for each row
execute function public.enforce_employee_schedule_exception();

revoke execute on function public.enforce_employee_schedule_exception()
  from public, anon, authenticated;
