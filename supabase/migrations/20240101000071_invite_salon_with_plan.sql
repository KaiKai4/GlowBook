-- F03-3: la invitacion nace con su plan en una sola operacion.
--
-- Problema: invitations.repo.ts llamaba a invite_salon(p_email) y despues hacia un update aparte de
-- salon_invitations.plan_id con el cliente admin (service_role). Si ese update fallaba, quedaba una
-- invitacion sin plan, y la RPC podia hacer la escritura completa sin service_role.
--
-- Solucion: invite_salon acepta p_plan_id opcional y lo guarda en el mismo insert. Si se pasa un plan,
-- valida que existe y no esta archivado (SQLSTATE 22023). Se conservan la comprobacion
-- is_platform_admin(), el hash del token, el valor devuelto y los grants de 064 (solo authenticated).
--
-- Forward-only: la firma antigua invite_salon(text) se elimina y la nueva se crea en esta misma
-- migracion (permitido por scripts/quality/migration-rules.mjs). Sin cambios de tablas ni datos.

set lock_timeout = '1s';
set statement_timeout = '5s';

begin;

drop function if exists public.invite_salon(text);

create function public.invite_salon(p_email text, p_plan_id uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if not public.is_platform_admin() then
    raise exception 'Solo la plataforma puede invitar salones';
  end if;

  if p_plan_id is not null and not exists (
    select 1 from commercial_plans
    where id = p_plan_id and status <> 'archived'
  ) then
    raise exception 'El plan no existe o está archivado' using errcode = '22023';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into salon_invitations (email, invited_by, token_hash, plan_id)
    values (
      lower(p_email),
      auth.uid(),
      encode(sha256(convert_to(v_token, 'utf8')), 'hex'),
      p_plan_id
    );
  return v_token;
end $$;

-- Mismos grants que 064: solo el cliente de usuario (la comprobacion de plataforma va dentro).
revoke all on function public.invite_salon(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.invite_salon(text, uuid) to authenticated;

commit;
