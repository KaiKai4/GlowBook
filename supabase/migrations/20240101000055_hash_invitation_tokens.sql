-- Los tokens de invitacion dejan de guardarse en claro: la columna pasa a
-- contener sha256(token) en hex. El token en claro solo existe en el enlace
-- que se envia manualmente; las funciones de aceptacion hashean el token
-- recibido antes de buscarlo. Los enlaces pendientes emitidos antes de esta
-- migracion siguen funcionando porque el backfill hashea los valores actuales.

-- ─── employee_invitations ────────────────────────────────────────────────────
alter table employee_invitations rename column token to token_hash;
update employee_invitations
  set token_hash = encode(sha256(convert_to(token_hash, 'utf8')), 'hex');

-- ─── salon_invitations ───────────────────────────────────────────────────────
-- El default generaba el token en claro dentro de la tabla; ahora lo genera
-- invite_salon() y persiste solo el hash.
alter table salon_invitations alter column token drop default;
alter table salon_invitations rename column token to token_hash;
update salon_invitations
  set token_hash = encode(sha256(convert_to(token_hash, 'utf8')), 'hex');

-- ─── invite_salon: genera el token, guarda el hash, devuelve el claro ───────
create or replace function invite_salon(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if not public.is_platform_admin() then
    raise exception 'Solo la plataforma puede invitar salones';
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into salon_invitations (email, invited_by, token_hash)
    values (lower(p_email), auth.uid(), encode(sha256(convert_to(v_token, 'utf8')), 'hex'));
  return v_token;
end $$;

-- ─── accept_invitation: compara contra el hash ───────────────────────────────
create or replace function accept_invitation(
  p_token text, p_salon_name text, p_full_name text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv salon_invitations%rowtype; v_salon uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  select * into v_inv from salon_invitations
    where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
      and status = 'pending' and expires_at > now() for update;
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
    where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
      and status = 'pending' and expires_at > now() for update;
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
