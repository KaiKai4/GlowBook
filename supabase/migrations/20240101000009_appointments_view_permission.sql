-- Adds a read-only appointments permission so collaborators (e.g. stylists) can
-- see their own calendar WITHOUT being able to create/edit appointments or send
-- reminders. Previously the calendar was gated behind appointments.manage, which
-- forced "view only" collaborators to also receive create/notify capabilities.

-- ── 1. New permission ─────────────────────────────────────────────────────────
insert into permissions (key, description) values
  ('appointments.view', 'Ver el calendario y citas propias (solo lectura)')
on conflict (key) do nothing;

-- ── 2. Backfill existing "Colaborador" roles with read-only access ────────────
insert into role_permissions (role_id, permission_id, salon_id)
select r.id, p.id, r.salon_id
from roles r
cross join permissions p
where r.is_system = false
  and r.name = 'Colaborador'
  and p.key = 'appointments.view'
on conflict (role_id, permission_id) do nothing;

-- Roles that can already manage appointments should also keep calendar access.
insert into role_permissions (role_id, permission_id, salon_id)
select rp.role_id, pv.id, rp.salon_id
from role_permissions rp
join permissions pm on pm.id = rp.permission_id and pm.key = 'appointments.manage'
cross join permissions pv
where pv.key = 'appointments.view'
on conflict (role_id, permission_id) do nothing;

-- ── 3. Tighten SELECT policies: require view OR manage, then apply scope ───────
drop policy if exists appt_select on appointments;
create policy appt_select on appointments for select using (
  salon_id = public.salon_id()
  and (public.has_permission('appointments.view') or public.has_permission('appointments.manage'))
  and (
    public.has_permission('appointments.view_all')
    or exists (
      select 1 from appointment_items ai
      join employees e on e.id = ai.employee_id
      where ai.appointment_id = appointments.id
        and e.profile_id = auth.uid()
    )
  )
);

drop policy if exists item_select on appointment_items;
create policy item_select on appointment_items for select using (
  salon_id = public.salon_id()
  and (public.has_permission('appointments.view') or public.has_permission('appointments.manage'))
  and (
    public.has_permission('appointments.view_all')
    or employee_id in (select id from employees where profile_id = auth.uid())
  )
);

-- ── 4. Wire the new permission into the salon bootstrap function ───────────────
create or replace function create_salon_with_owner(p_salon_name text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_salon uuid;
  v_owner_role uuid;
  v_recep_role uuid;
  v_colab_role uuid;
begin
  insert into salons (name) values (p_salon_name) returning id into v_salon;

  insert into roles (salon_id, name, is_system)
    values (v_salon, 'Owner', true) returning id into v_owner_role;
  insert into roles (salon_id, name)
    values (v_salon, 'Recepcionista') returning id into v_recep_role;
  insert into roles (salon_id, name)
    values (v_salon, 'Colaborador') returning id into v_colab_role;

  -- Owner: all permissions
  insert into role_permissions (role_id, permission_id, salon_id)
    select v_owner_role, id, v_salon from permissions;

  -- Receptionist: full appointments + customers + reminders + reports
  insert into role_permissions (role_id, permission_id, salon_id)
    select v_recep_role, id, v_salon from permissions
    where key in (
      'appointments.view',
      'appointments.manage',
      'appointments.view_all',
      'customers.manage',
      'reminders.send',
      'reports.view'
    );

  -- Colaborador: read-only calendar of their own appointments
  insert into role_permissions (role_id, permission_id, salon_id)
    select v_colab_role, id, v_salon from permissions
    where key = 'appointments.view';

  -- Seed default business hours: Mon-Sat 08:00-18:00, Sunday closed
  insert into salon_business_hours (salon_id, day_of_week, is_open, open_time, close_time)
  values
    (v_salon, 0, true,  '08:00', '18:00'),
    (v_salon, 1, true,  '08:00', '18:00'),
    (v_salon, 2, true,  '08:00', '18:00'),
    (v_salon, 3, true,  '08:00', '18:00'),
    (v_salon, 4, true,  '08:00', '18:00'),
    (v_salon, 5, true,  '08:00', '18:00'),
    (v_salon, 6, false, null,    null   );

  insert into profiles (id, salon_id, role_id, is_owner, full_name)
    values (auth.uid(), v_salon, v_owner_role, true, p_full_name);

  return v_salon;
end $$;

revoke execute on function create_salon_with_owner(text, text) from public, anon, authenticated;
