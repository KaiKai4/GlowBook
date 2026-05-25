-- Platform maintenance tasks run with the service_role and must be able to
-- delete a whole tenant, including its final owner profile. Regular users are
-- still protected by the last-owner invariant.
create or replace function ensure_salon_has_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_remaining int;
  v_salon uuid := old.salon_id;
begin
  -- Trusted backend contexts (service_role) bypass the guard for destructive
  -- platform operations such as deleting an entire salon.
  if coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Only act when an active owner stops being an active owner.
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
