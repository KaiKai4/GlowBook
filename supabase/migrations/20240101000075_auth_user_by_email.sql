-- Busqueda de un usuario de Auth por email en una sola consulta.
--
-- Problema: findAuthUserByEmail paginaba auth.admin.listUsers (hasta 50.000 usuarios) para encontrar
-- uno por email. Es lento y crece con el numero de cuentas.
--
-- Solucion: public.find_auth_user_id_by_email(p_email) consulta auth.users por email normalizado
-- (lower/trim) y devuelve el id o null. La TS obtiene el usuario completo con getUserById.
--   * security definer: necesita leer auth.users, que el cliente de usuario no puede leer.
--   * set search_path fijo: evita que una tabla con el mismo nombre en public altere la consulta.
--   * EXECUTE solo para service_role: nunca desde el navegador ni como cliente de usuario, para que
--     nadie pueda enumerar cuentas de Auth.
--
-- Forward-only: solo añade la funcion y sus grants.

set lock_timeout = '2s';
set statement_timeout = '30s';

begin;

create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select u.id
  from auth.users u
  where lower(btrim(u.email)) = lower(btrim(p_email))
  limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;

commit;
