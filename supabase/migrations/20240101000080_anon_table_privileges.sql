-- Seguridad: anon no tiene privilegios de tabla ni de secuencia en public.
--
-- Problema: Supabase concede por defecto a anon SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
-- sobre todas las tablas de public (default privileges del rol postgres). Las politicas RLS son la
-- barrera final, pero anon no debe tener siquiera el privilegio: la defensa en profundidad exige que un
-- fallo de politica no exponga datos.
--
-- Solucion (forward-only, sin tocar datos):
--   * revoke de tablas y secuencias existentes a anon.
--   * default privileges: las tablas y secuencias futuras de public no nacen con privilegios para anon.
--   * la politica perm_read (sobre permissions) pasa a authenticated; ya no aplica a public.
--
-- Las RPC de public ya estan revocadas a anon en 20240101000064_security_hardening.sql.
-- Los flujos sin sesion (invitaciones, alta de cuenta) usan service_role en servidor, no anon.
-- Prueba: supabase/tests/24_anon_table_privileges.sql.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

alter policy perm_read on public.permissions to authenticated;

commit;
