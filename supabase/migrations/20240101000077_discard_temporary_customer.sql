-- Descarte de un cliente temporal en una sola transaccion.
--
-- Problema: al cancelar una cita de un cliente temporal y elegir "No, descartar datos", cancelAppointment
-- cancelaba la cita y despues borraba la fila de customers desde el repositorio. La cita cancelada seguia
-- referenciando al cliente (fk_appointments_customer_same_salon, on delete restrict) y Postgres rechazaba
-- el borrado (23503). El aviso "no pudimos descartar los datos temporales" aparecia siempre.
--
-- Solucion: public.discard_temporary_customer(p_customer_id) borra, en la misma transaccion, las citas
-- canceladas o no presentadas del cliente y despues el cliente. Si queda una cita activa o completada,
-- no se descarta: el historial no se borra en silencio.
--   * security invoker: la RLS ya expresa la regla (cust_delete, appt_delete, item_delete exigen
--     salon_id = salon_id() y el permiso correspondiente). La funcion comprueba los permisos antes para
--     devolver un error claro en lugar de un borrado silencioso de cero filas.
--   * Exige customers.manage y appointments.manage: sin appointments.manage la RLS de appointments no
--     borraria nada y el cliente seguiria referenciado.
--   * EXECUTE solo para authenticated.
--
-- Forward-only: solo añade la funcion y sus grants.

set lock_timeout = '2s';
set statement_timeout = '30s';

begin;

create or replace function public.discard_temporary_customer(p_customer_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon_id uuid := public.salon_id();
  v_is_temporary boolean;
  v_blocking_count integer;
begin
  if not public.has_permission('customers.manage') or not public.has_permission('appointments.manage') then
    raise exception 'No tienes permiso para descartar clientes.' using errcode = '42501';
  end if;

  select c.is_temporary
    into v_is_temporary
  from public.customers c
  where c.id = p_customer_id
    and c.salon_id = v_salon_id;

  if not found then
    raise exception 'El cliente no existe en este salón.' using errcode = 'P0002';
  end if;

  if not v_is_temporary then
    raise exception 'Solo se pueden descartar clientes temporales.' using errcode = '22023';
  end if;

  select count(*)
    into v_blocking_count
  from public.appointments a
  where a.customer_id = p_customer_id
    and a.salon_id = v_salon_id
    and a.status not in ('cancelled', 'no_show');

  if v_blocking_count > 0 then
    raise exception 'El cliente tiene citas activas o completadas y no se puede descartar.' using errcode = '22023';
  end if;

  -- Los appointment_items caen por cascada (appointment_id on delete cascade).
  delete from public.appointments a
  where a.customer_id = p_customer_id
    and a.salon_id = v_salon_id;

  delete from public.customers c
  where c.id = p_customer_id
    and c.salon_id = v_salon_id
    and c.is_temporary = true;
end;
$$;

revoke all on function public.discard_temporary_customer(uuid) from public, anon;
grant execute on function public.discard_temporary_customer(uuid) to authenticated;

commit;
