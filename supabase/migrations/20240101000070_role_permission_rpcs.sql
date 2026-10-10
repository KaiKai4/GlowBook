-- Roles atomicos: crear un rol con sus permisos y reemplazar los permisos de un rol en una sola
-- transaccion.
--
-- Problema: el repositorio hacia createRole (insert) y luego setRolePermissions (delete + insert)
-- en llamadas separadas. Un fallo a mitad dejaba el rol sin permisos o con permisos parciales.
--
-- Solucion: dos RPC de cliente de usuario, SECURITY INVOKER, que hacen todo en una transaccion
-- (una llamada RPC es una transaccion) y dejan que la RLS de roles y role_permissions aplique:
--   * roles_insert / roles_update / roles_delete y rp_insert / rp_delete exigen roles.manage y
--     salon_id = public.salon_id(). Las RPC comprueban roles.manage explicitamente antes de escribir
--     para devolver un error claro (42501) en lugar de una violacion de RLS.
--   * create_role_with_permissions(p_name, p_permission_keys) returns uuid
--   * replace_role_permissions(p_role_id, p_permission_keys) returns void
--     Falla con P0002 si el rol no existe o no es del salon del claim.
--   * Ambas fallan con 22023 si alguna clave no existe en public.permissions, sin escribir nada.
--
-- Forward-only, expand/contract: no cambia tablas ni datos; solo añade funciones y grants.

set lock_timeout = '2s';
set statement_timeout = '30s';

begin;

-- 1. Crear un rol con permisos. El rol y sus permisos se insertan en la misma transaccion.
create or replace function public.create_role_with_permissions(p_name text, p_permission_keys text[])
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_keys text[] := coalesce(p_permission_keys, '{}'::text[]);
  v_role uuid;
begin
  if not public.has_permission('roles.manage') then
    raise exception 'No tienes permiso para gestionar roles.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(v_keys) as k
    where not exists (select 1 from public.permissions p where p.key = k)
  ) then
    raise exception 'Uno o más permisos no existen.' using errcode = '22023';
  end if;

  insert into public.roles (salon_id, name)
  values (v_salon, p_name)
  returning id into v_role;

  insert into public.role_permissions (role_id, permission_id, salon_id)
  select v_role, p.id, v_salon
  from public.permissions p
  where p.key = any (v_keys);

  return v_role;
end;
$$;

-- 2. Reemplazar el conjunto de permisos de un rol del salon. Lista vacia = sin permisos.
create or replace function public.replace_role_permissions(p_role_id uuid, p_permission_keys text[])
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_keys text[] := coalesce(p_permission_keys, '{}'::text[]);
begin
  if not public.has_permission('roles.manage') then
    raise exception 'No tienes permiso para gestionar roles.' using errcode = '42501';
  end if;

  perform 1
  from public.roles r
  where r.id = p_role_id
    and r.salon_id = v_salon
  for update;

  if not found then
    raise exception 'Rol no encontrado.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(v_keys) as k
    where not exists (select 1 from public.permissions p where p.key = k)
  ) then
    raise exception 'Uno o más permisos no existen.' using errcode = '22023';
  end if;

  delete from public.role_permissions
  where role_id = p_role_id
    and salon_id = v_salon;

  insert into public.role_permissions (role_id, permission_id, salon_id)
  select p_role_id, p.id, v_salon
  from public.permissions p
  where p.key = any (v_keys);
end;
$$;

-- 3. Grants: nadie por defecto; solo usuarios autenticados (cliente de usuario).
revoke all on function public.create_role_with_permissions(text, text[]) from public, anon, service_role;
grant execute on function public.create_role_with_permissions(text, text[]) to authenticated;

revoke all on function public.replace_role_permissions(uuid, text[]) from public, anon, service_role;
grant execute on function public.replace_role_permissions(uuid, text[]) to authenticated;

commit;
