-- ─── Auth helpers ───────────────────────────────────────────────────────────

-- Enhanced salon_id resolver: prefer the JWT claim (fast, set by the Custom Access
-- Token Hook) but fall back to the profiles table so isolation works even before
-- the hook is enabled in the dashboard. security definer bypasses RLS on profiles
-- (function owner is the table owner), so there is no recursion with profile policies.
create or replace function public.salon_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(auth.jwt() ->> 'salon_id', '')::uuid,
    (select salon_id from profiles where id = auth.uid())
  )
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from profiles where id = auth.uid()), false)
$$;

create or replace function public.has_permission(perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner() or exists (
    select 1
    from profiles p
    join role_permissions rp on rp.role_id = p.role_id
    join permissions pm on pm.id = rp.permission_id
    where p.id = auth.uid() and pm.key = perm
  )
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;

-- ─── Trigger: recalculate appointment header from items ──────────────────────
create or replace function recalc_appointment() returns trigger language plpgsql as $$
declare
  aid uuid := coalesce(new.appointment_id, old.appointment_id);
begin
  update appointments a
  set
    start_time  = sub.min_start,
    end_time    = sub.max_end,
    total_price = coalesce(sub.total, 0),
    updated_at  = now()
  from (
    select
      min(start_time) as min_start,
      max(end_time)   as max_end,
      sum(price)      as total
    from appointment_items
    where appointment_id = aid
  ) sub
  where a.id = aid;
  return null;
end $$;

create trigger trg_recalc_appt
  after insert or update or delete on appointment_items
  for each row execute function recalc_appointment();

-- ─── Enable RLS on ALL tables ───────────────────────────────────────────────
alter table salons                   enable row level security;
alter table salon_business_hours     enable row level security;
alter table profiles                 enable row level security;
alter table permissions              enable row level security;
alter table roles                    enable row level security;
alter table role_permissions         enable row level security;
alter table customers                enable row level security;
alter table service_categories       enable row level security;
alter table services                 enable row level security;
alter table employees                enable row level security;
alter table employee_services        enable row level security;
alter table employee_categories      enable row level security;
alter table work_schedules           enable row level security;
alter table appointments             enable row level security;
alter table appointment_items        enable row level security;
alter table notification_templates   enable row level security;
alter table appointment_reminder_log enable row level security;
alter table platform_admins          enable row level security;
alter table salon_invitations        enable row level security;

-- ─── RLS policies ────────────────────────────────────────────────────────────

-- salons: read own salon; write with salon.manage
create policy salon_select on salons for select
  using (id = public.salon_id());
create policy salon_write on salons for all
  using (id = public.salon_id() and public.has_permission('salon.manage'))
  with check (id = public.salon_id() and public.has_permission('salon.manage'));

-- salon_business_hours: same pattern
create policy sbh_select on salon_business_hours for select
  using (salon_id = public.salon_id());
create policy sbh_write on salon_business_hours for all
  using (salon_id = public.salon_id() and public.has_permission('salon.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('salon.manage'));

-- profiles: own profile + same salon; write = own profile OR employees.manage
create policy profile_select on profiles for select
  using (id = auth.uid() or salon_id = public.salon_id());
create policy profile_write on profiles for all
  using (salon_id = public.salon_id() and (id = auth.uid() or public.has_permission('employees.manage')))
  with check (salon_id = public.salon_id() and (id = auth.uid() or public.has_permission('employees.manage')));

-- permissions: global catalog, read-only for authenticated users
create policy perm_read on permissions for select
  using (auth.uid() is not null);

-- roles: per salon; write requires roles.manage
create policy roles_select on roles for select
  using (salon_id = public.salon_id());
create policy roles_write on roles for all
  using (salon_id = public.salon_id() and public.has_permission('roles.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('roles.manage'));

-- role_permissions: per salon; write requires roles.manage
create policy rp_select on role_permissions for select
  using (salon_id = public.salon_id());
create policy rp_write on role_permissions for all
  using (salon_id = public.salon_id() and public.has_permission('roles.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('roles.manage'));

-- customers (PII — explicit policies)
create policy cust_select on customers for select
  using (salon_id = public.salon_id());
create policy cust_write on customers for all
  using (salon_id = public.salon_id() and public.has_permission('customers.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('customers.manage'));

-- service_categories
create policy scat_select on service_categories for select
  using (salon_id = public.salon_id());
create policy scat_write on service_categories for all
  using (salon_id = public.salon_id() and public.has_permission('services.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('services.manage'));

-- services
create policy svc_select on services for select
  using (salon_id = public.salon_id());
create policy svc_write on services for all
  using (salon_id = public.salon_id() and public.has_permission('services.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('services.manage'));

-- employees
create policy emp_select on employees for select
  using (salon_id = public.salon_id());
create policy emp_write on employees for all
  using (salon_id = public.salon_id() and public.has_permission('employees.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('employees.manage'));

create policy emp_svc_select on employee_services for select
  using (salon_id = public.salon_id());
create policy emp_svc_write on employee_services for all
  using (salon_id = public.salon_id() and public.has_permission('employees.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('employees.manage'));

create policy emp_cat_select on employee_categories for select
  using (salon_id = public.salon_id());
create policy emp_cat_write on employee_categories for all
  using (salon_id = public.salon_id() and public.has_permission('employees.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('employees.manage'));

-- work_schedules
create policy ws_select on work_schedules for select
  using (salon_id = public.salon_id());
create policy ws_write on work_schedules for all
  using (salon_id = public.salon_id() and public.has_permission('employees.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('employees.manage'));

-- appointments: collaborator sees only their own; view_all perm to see all
create policy appt_select on appointments for select using (
  salon_id = public.salon_id() and (
    public.has_permission('appointments.view_all')
    or exists (
      select 1 from appointment_items ai
      join employees e on e.id = ai.employee_id
      where ai.appointment_id = appointments.id
        and e.profile_id = auth.uid()
    )
  )
);
create policy appt_write on appointments for all
  using (salon_id = public.salon_id() and public.has_permission('appointments.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('appointments.manage'));

-- appointment_items: same visibility logic
create policy item_select on appointment_items for select using (
  salon_id = public.salon_id() and (
    public.has_permission('appointments.view_all')
    or employee_id in (select id from employees where profile_id = auth.uid())
  )
);
create policy item_write on appointment_items for all
  using (salon_id = public.salon_id() and public.has_permission('appointments.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('appointments.manage'));

-- notification_templates
create policy nt_select on notification_templates for select
  using (salon_id = public.salon_id());
create policy nt_write on notification_templates for all
  using (salon_id = public.salon_id() and public.has_permission('reminders.send'))
  with check (salon_id = public.salon_id() and public.has_permission('reminders.send'));

-- appointment_reminder_log
create policy arl_select on appointment_reminder_log for select
  using (salon_id = public.salon_id());
create policy arl_write on appointment_reminder_log for all
  using (salon_id = public.salon_id() and public.has_permission('reminders.send'))
  with check (salon_id = public.salon_id() and public.has_permission('reminders.send'));

-- platform_admins: only self-read (platform admin can see their own entry)
create policy padmin_self on platform_admins for select
  using (public.is_platform_admin());

-- salon_invitations: only platform admins
create policy inv_platform on salon_invitations for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
