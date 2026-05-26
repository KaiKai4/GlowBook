-- Atomic tenant deletion for platform admins.
-- Deletes all public salon data in one Postgres transaction and returns the
-- linked auth user ids so the server can remove Supabase Auth accounts after.

create or replace function public.delete_salon_completely(p_salon_id uuid)
returns table(user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_salon_id is null then
    raise exception 'Salon id is required';
  end if;

  perform 1 from salons where id = p_salon_id for update;
  if not found then
    raise exception 'Salon not found';
  end if;

  return query
    select profiles.id
    from profiles
    where profiles.salon_id = p_salon_id;

  -- Operational records and logs.
  delete from appointment_reminder_log where salon_id = p_salon_id;
  delete from appointment_items where salon_id = p_salon_id;
  delete from appointments where salon_id = p_salon_id;
  delete from feedback_reports where salon_id = p_salon_id;

  -- Staff access and assignment data.
  delete from employee_invitations where salon_id = p_salon_id;
  delete from employee_services where salon_id = p_salon_id;
  delete from employee_categories where salon_id = p_salon_id;
  delete from work_schedules where salon_id = p_salon_id;
  update employees set profile_id = null where salon_id = p_salon_id;
  delete from employees where salon_id = p_salon_id;

  -- Catalog, customers, templates and salon configuration.
  delete from notification_templates where salon_id = p_salon_id;
  delete from services where salon_id = p_salon_id;
  delete from service_categories where salon_id = p_salon_id;
  delete from customers where salon_id = p_salon_id;
  delete from salon_business_hours where salon_id = p_salon_id;
  delete from salon_invitations where salon_id = p_salon_id;

  -- RBAC data must be removed after profiles no longer depend on roles.
  delete from role_permissions where salon_id = p_salon_id;
  update profiles set role_id = null where salon_id = p_salon_id;
  delete from profiles where salon_id = p_salon_id;
  delete from roles where salon_id = p_salon_id;

  delete from salons where id = p_salon_id;
end;
$$;

revoke execute on function public.delete_salon_completely(uuid) from public, anon, authenticated;
grant execute on function public.delete_salon_completely(uuid) to service_role;
