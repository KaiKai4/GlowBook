-- Fase 2 (seguridad por defecto): matriz minima de EXECUTE sobre funciones de public.
--
-- Roles que llaman a cada funcion (verificado en src/ y en pg_proc):
--   * cliente de usuario (createSupabaseServerClient => authenticated)
--   * cliente admin (createSupabaseAdminClient => service_role)
--   * Auth Hook (supabase_auth_admin)
--   * helpers usados por politicas RLS (authenticated; anon ya no evalua politicas, ver abajo)
--   * triggers (no requieren EXECUTE para clientes: se disparan sin comprobar el grant)
--   * funciones SECURITY DEFINER invocadas desde otras funciones (se ejecutan como owner postgres)
--
-- Las funciones de extensiones instaladas en public (btree_gist: gbt_*, *_dist) no son propiedad
-- de la migracion y se excluyen de estos cambios.

set lock_timeout = '1s';
set statement_timeout = '5s';

begin;

-- 1. Revocar EXECUTE a todas las funciones de public (no extension) y reconstruir la matriz.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f.sig);
  end loop;
end
$$;

-- 2. Helpers de RLS: authenticated. Las politicas que los usan pasan a aplicar a authenticated,
--    asi anon no las evalua (antes obtenia cero filas porque salon_id() es null sin sesion).
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and 'public' = any(roles)
      and coalesce(qual, '') || ' ' || coalesce(with_check, '')
          ~ '\m(salon_id|has_permission|is_owner|is_platform_admin)\s*\('
  loop
    execute format('alter policy %I on %I.%I to authenticated', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$$;

grant execute on function public.salon_id() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

-- 3. RPC de cliente de usuario (authenticated).
grant execute on function public.create_appointment(jsonb) to authenticated;
grant execute on function public.update_appointment(jsonb) to authenticated;
grant execute on function public.invite_salon(text) to authenticated;
grant execute on function public.record_retail_sale(uuid, uuid, uuid, text, numeric, numeric, text, text) to authenticated;
grant execute on function public.record_inventory_transfer(uuid, uuid, text, text, numeric, text) to authenticated;
grant execute on function public.record_inventory_purchase(uuid, text, date, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.report_monthly_history(uuid, timestamptz, timestamptz, text) to authenticated;

-- 4. RPC de cliente admin (service_role).
grant execute on function public.delete_salon_completely(uuid) to service_role;
grant execute on function public.platform_salon_overviews() to service_role;
grant execute on function public.accept_invitation_admin(text, uuid, text, text, text) to service_role;
grant execute on function public.count_salon_usage(uuid, jsonb) to service_role;

-- 5. Auth Hook: solo el rol de autenticacion de Supabase.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- Sin grant de cliente: triggers (set_updated_at, recalc_appointment, protect_profile_privileges,
-- ensure_salon_has_owner, log_salon_activity, enforce_employee_schedule_exception) y
-- funciones internas (apply_inventory_stock_delta, create_salon_with_owner x2, accept_invitation)
-- que solo se invocan desde otras funciones SECURITY DEFINER o no tienen llamador en src/.

-- Las funciones futuras de public no nacen ejecutables por public ni por anon.
alter default privileges in schema public revoke execute on functions from public, anon;

-- 6. search_path fijado en funciones que no lo tenian (sin redefinir su cuerpo).
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.recalc_appointment() set search_path = public, pg_temp;
alter function public.enforce_employee_schedule_exception() set search_path = public, pg_temp;
alter function public.report_monthly_history(uuid, timestamptz, timestamptz, text) set search_path = public, pg_temp;

-- 7. Rate limit compartido entre instancias (serverless). Solo service_role lo usa; RLS sin politicas
--    deniega a cualquier otro rol aunque tuviera privilegios de tabla.
create table if not exists public.rate_limit_buckets (
  key text primary key,
  window_started_at timestamptz not null,
  count bigint not null,
  expires_at timestamptz not null
);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated;

create index if not exists rate_limit_buckets_expires_at_idx
  on public.rate_limit_buckets (expires_at);

-- Cuenta un intento para la clave dentro de la ventana. Atomica (insert ... on conflict).
-- Limpieza acotada: como mucho 100 filas expiradas por llamada.
-- count se limita a p_max + 1 mientras la clave sigue bloqueada (count es bigint: squawk prefer-bigint-over-int).
create or replace function public.consume_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count bigint;
  v_expires_at timestamptz;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    raise exception 'clave de rate limit invalida' using errcode = '22023';
  end if;

  if p_max is null or p_max <= 0 then
    raise exception 'p_max debe ser mayor que 0' using errcode = '22023';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'p_window_seconds debe estar entre 1 y 86400' using errcode = '22023';
  end if;

  delete from public.rate_limit_buckets
  where key in (
    select expired.key
    from public.rate_limit_buckets expired
    where expired.expires_at <= v_now
    order by expired.expires_at
    limit 100
  );

  insert into public.rate_limit_buckets as b (key, window_started_at, count, expires_at)
  values (p_key, v_now, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set window_started_at = case
          when b.expires_at <= v_now then v_now
          else b.window_started_at
        end,
        count = case
          when b.expires_at <= v_now then 1
          when b.count <= p_max then b.count + 1
          else b.count
        end,
        expires_at = case
          when b.expires_at <= v_now then v_now + make_interval(secs => p_window_seconds)
          else b.expires_at
        end
  returning b.count, b.expires_at into v_count, v_expires_at;

  return query select
    v_count <= p_max,
    case
      when v_count <= p_max then 0
      else greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer)
    end;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

commit;
