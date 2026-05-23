-- ─── Privilege-escalation guard on profiles ─────────────────────────────────
-- RLS lets a user UPDATE their own profile row (id = auth.uid()), and Postgres
-- RLS cannot restrict WHICH columns are written. Without this guard, a
-- collaborator could run `update profiles set is_owner = true where id = auth.uid()`
-- (or reassign their own role_id) and escalate to full salon admin.
-- This trigger blocks changes to privilege columns unless the editor actually
-- has roles.manage (or is an owner). Self-service edits (full_name, etc.) remain allowed.

create or replace function protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Trusted backend contexts (service_role) bypass the guard.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if (new.is_owner  is distinct from old.is_owner)
     or (new.role_id   is distinct from old.role_id)
     or (new.salon_id  is distinct from old.salon_id) then
    if not (public.is_owner() or public.has_permission('roles.manage')) then
      raise exception 'No autorizado para cambiar privilegios del perfil';
    end if;
  end if;

  return new;
end $$;

create trigger trg_protect_profile_privileges
  before update on profiles
  for each row execute function protect_profile_privileges();

-- ─── Last-owner invariant ────────────────────────────────────────────────────
-- A salon must always keep at least one owner (§2.2). Block demoting/deactivating
-- the final owner, whether via UPDATE (is_owner -> false / is_active -> false) or DELETE.
create or replace function ensure_salon_has_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_remaining int;
  v_salon uuid := old.salon_id;
begin
  -- Only act when an active owner stops being an active owner
  if old.is_owner and (
       tg_op = 'DELETE'
       or not new.is_owner
       or not new.is_active
     ) then
    select count(*) into v_remaining
      from profiles
      where salon_id = v_salon
        and is_owner
        and is_active
        and id <> old.id;

    if v_remaining = 0 then
      raise exception 'El salón debe tener al menos un owner activo';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger trg_ensure_salon_has_owner
  before update or delete on profiles
  for each row execute function ensure_salon_has_owner();
