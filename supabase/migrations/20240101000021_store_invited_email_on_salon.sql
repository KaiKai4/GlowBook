-- Keep the salon contact email visible in the platform salon list.
-- Older salons still fall back to the accepted invitation email in the app.

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
  update salons set email = lower(v_inv.email) where id = v_salon and email = '';
  update salon_invitations set status='accepted', accepted_at=now(), salon_id=v_salon where id=v_inv.id;
  return v_salon;
end $$;

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
  update salons set email = lower(p_email) where id = v_salon and email = '';
  update salon_invitations set status='accepted', accepted_at=now(), salon_id=v_salon where id=v_inv.id;
  return v_salon;
end $$;

revoke execute on function accept_invitation_admin(text, uuid, text, text, text) from public, anon, authenticated;
