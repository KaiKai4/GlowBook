-- Robust invite onboarding: create the salon from a trusted server context
-- (service_role) passing the owner's user_id explicitly, so it no longer depends
-- on auth.uid() / email confirmation. Fixes "null value in column id of profiles"
-- when Supabase email confirmation leaves signUp without a session.

-- New overload taking the owner id explicitly.
create or replace function create_salon_with_owner(
  p_owner_id  uuid,
  p_salon_name text,
  p_full_name  text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_salon uuid; v_owner_role uuid; v_recep_role uuid; v_colab_role uuid;
begin
  insert into salons (name) values (p_salon_name) returning id into v_salon;

  insert into roles (salon_id, name, is_system) values (v_salon, 'Owner', true) returning id into v_owner_role;
  insert into roles (salon_id, name) values (v_salon, 'Recepcionista') returning id into v_recep_role;
  insert into roles (salon_id, name) values (v_salon, 'Colaborador')   returning id into v_colab_role;

  insert into role_permissions (role_id, permission_id, salon_id)
    select v_owner_role, id, v_salon from permissions;
  insert into role_permissions (role_id, permission_id, salon_id)
    select v_recep_role, id, v_salon from permissions
    where key in ('appointments.manage','appointments.view_all','customers.manage','reminders.send','reports.view');

  insert into salon_business_hours (salon_id, day_of_week, is_open, open_time, close_time) values
    (v_salon, 0, true,  '08:00', '18:00'),
    (v_salon, 1, true,  '08:00', '18:00'),
    (v_salon, 2, true,  '08:00', '18:00'),
    (v_salon, 3, true,  '08:00', '18:00'),
    (v_salon, 4, true,  '08:00', '18:00'),
    (v_salon, 5, true,  '08:00', '18:00'),
    (v_salon, 6, false, null,    null   );

  insert into profiles (id, salon_id, role_id, is_owner, full_name)
    values (p_owner_id, v_salon, v_owner_role, true, p_full_name);

  return v_salon;
end $$;
revoke execute on function create_salon_with_owner(uuid, text, text) from public, anon, authenticated;

-- Remove the old auth.uid()-based overload (no longer used).
drop function if exists create_salon_with_owner(text, text);

-- Authenticated path (kept for completeness) now delegates to the new overload.
create or replace function accept_invitation(
  p_token text, p_salon_name text, p_full_name text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv salon_invitations%rowtype; v_salon uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  select * into v_inv from salon_invitations
    where token = p_token and status = 'pending' and expires_at > now() for update;
  if not found then raise exception 'Invitación inválida o expirada'; end if;
  if lower(v_inv.email) <> lower(auth.jwt() ->> 'email') then
    raise exception 'Esta invitación no corresponde a tu cuenta';
  end if;
  v_salon := create_salon_with_owner(auth.uid(), p_salon_name, p_full_name);
  update salon_invitations set status='accepted', accepted_at=now(), salon_id=v_salon where id=v_inv.id;
  return v_salon;
end $$;

-- Server/admin path: a trusted backend (service_role) passes the user_id + email.
-- Validates the token and that the email matches the invitation.
create or replace function accept_invitation_admin(
  p_token text, p_user_id uuid, p_email text, p_salon_name text, p_full_name text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv salon_invitations%rowtype; v_salon uuid;
begin
  select * into v_inv from salon_invitations
    where token = p_token and status = 'pending' and expires_at > now() for update;
  if not found then raise exception 'Invitación inválida o expirada'; end if;
  if lower(v_inv.email) <> lower(p_email) then
    raise exception 'Esta invitación no corresponde a esta cuenta';
  end if;
  v_salon := create_salon_with_owner(p_user_id, p_salon_name, p_full_name);
  update salon_invitations set status='accepted', accepted_at=now(), salon_id=v_salon where id=v_inv.id;
  return v_salon;
end $$;
revoke execute on function accept_invitation_admin(text, uuid, text, text, text) from public, anon, authenticated;
