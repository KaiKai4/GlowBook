-- ─── Permission catalog seed (run once via migration) ───────────────────────
insert into permissions (key, description) values
  ('salon.manage',          'Editar datos del salón y ajustes'),
  ('roles.manage',          'Crear roles y asignar permisos'),
  ('employees.manage',      'Gestionar colaboradores'),
  ('services.manage',       'Gestionar categorías y servicios'),
  ('customers.manage',      'Gestionar clientes'),
  ('appointments.manage',   'Crear, editar y cancelar citas'),
  ('appointments.view_all', 'Ver todas las citas del salón'),
  ('reports.view',          'Ver dashboard y reportes'),
  ('reminders.send',        'Enviar recordatorios')
on conflict (key) do nothing;

-- ─── create_salon_with_owner: internal RPC (only called via accept_invitation)
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

  -- Receptionist: appointments + customers + reminders + reports
  insert into role_permissions (role_id, permission_id, salon_id)
    select v_recep_role, id, v_salon from permissions
    where key in (
      'appointments.manage',
      'appointments.view_all',
      'customers.manage',
      'reminders.send',
      'reports.view'
    );

  -- Colaborador: no management permissions (RLS limits to own appointments)

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

-- Lock down internal function: not callable directly from anon/authenticated
revoke execute on function create_salon_with_owner(text, text) from public, anon, authenticated;

-- ─── Platform: invite_salon (only platform admins) ──────────────────────────
create or replace function invite_salon(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if not public.is_platform_admin() then
    raise exception 'Solo la plataforma puede invitar salones';
  end if;
  insert into salon_invitations (email, invited_by)
    values (lower(p_email), auth.uid())
    returning token into v_token;
  return v_token;
end $$;

-- ─── accept_invitation: the ONLY public path to create a salon ──────────────
create or replace function accept_invitation(
  p_token      text,
  p_salon_name text,
  p_full_name  text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv salon_invitations%rowtype;
  v_salon uuid;
begin
  select * into v_inv
    from salon_invitations
    where token = p_token
      and status = 'pending'
      and expires_at > now()
    for update;

  if not found then
    raise exception 'Invitación inválida o expirada';
  end if;

  -- Email of the invitation must match the authenticated user's email
  if lower(v_inv.email) <> lower(auth.jwt() ->> 'email') then
    raise exception 'Esta invitación no corresponde a tu cuenta';
  end if;

  v_salon := create_salon_with_owner(p_salon_name, p_full_name);

  update salon_invitations
    set status = 'accepted',
        accepted_at = now(),
        salon_id = v_salon
    where id = v_inv.id;

  return v_salon;
end $$;
