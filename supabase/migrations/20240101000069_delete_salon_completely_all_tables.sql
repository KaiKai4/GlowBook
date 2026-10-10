-- F03-1: delete_salon_completely borra TODAS las tablas con salon_id, en orden de dependencias.
--
-- Problema: la RPC de 016 borraba una lista explicita antigua. Las tablas posteriores (inventario,
-- ventas de vitrina, gastos, planes comerciales del salon, excepciones de horario, actividad...)
-- no se tocaban y dependian de la cascada de `salons`. Pero inventory_purchase_items y
-- retail_sale_items tienen `on delete restrict` hacia inventory_products: segun el orden de la
-- cascada el borrado de salons fallaba. Ademas, los triggers de actividad insertan en
-- salon_activity_log al borrar en cascada, y eso rompe la FK si el salon ya no existe.
--
-- Solucion: esta migracion recrea la funcion con la misma firma, las mismas validaciones y el mismo
-- retorno (user_id de los perfiles). Borra explicitamente cada tabla con salon_id, hijos antes que
-- padres, y deja salons al final. Las pruebas supabase/tests/10_delete_salon_completely.sql y
-- 10b_delete_salon_catalog.sql impiden que una tabla nueva con salon_id quede sin tratar.
--
-- Forward-only, expand/contract: CREATE OR REPLACE con la misma firma; no cambia tablas ni datos.
-- Grants: solo service_role (como en 064). Se repiten por claridad; create or replace conserva los
-- permisos existentes.

begin;
set lock_timeout = '1s';
set statement_timeout = '30s';

create or replace function public.delete_salon_completely(p_salon_id uuid)
returns table(user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_salon_id is null then
    raise exception 'Salon id is required';
  end if;

  perform 1 from salons where id = p_salon_id for update;
  if not found then
    raise exception 'Salon not found';
  end if;

  return query
    select profiles.id
    from profiles
    where profiles.salon_id = p_salon_id;

  -- Registros operativos: primero los hijos (items y logs) y despues sus cabeceras.
  delete from appointment_reminder_log where salon_id = p_salon_id;
  delete from appointment_items where salon_id = p_salon_id;
  delete from appointments where salon_id = p_salon_id;
  delete from feedback_reports where salon_id = p_salon_id;

  -- Ventas de vitrina e inventario: los items referencian productos con RESTRICT, van antes.
  delete from retail_sale_items where salon_id = p_salon_id;
  delete from retail_sales where salon_id = p_salon_id;
  delete from inventory_purchase_items where salon_id = p_salon_id;
  delete from inventory_purchases where salon_id = p_salon_id;
  delete from inventory_movements where salon_id = p_salon_id;
  delete from inventory_stock_locations where salon_id = p_salon_id;
  delete from inventory_products where salon_id = p_salon_id;

  -- Gastos.
  delete from expenses where salon_id = p_salon_id;

  -- Planes comerciales del salon: asignaciones, overrides, alertas y pagos.
  delete from salon_plan_payments where salon_id = p_salon_id;
  delete from salon_plan_alerts where salon_id = p_salon_id;
  delete from salon_plan_overrides where salon_id = p_salon_id;
  delete from salon_plan_assignments where salon_id = p_salon_id;

  -- Staff: excepciones y horarios antes que colaboradores; invitaciones y asignaciones.
  delete from schedule_exceptions where salon_id = p_salon_id;
  delete from employee_invitations where salon_id = p_salon_id;
  delete from employee_services where salon_id = p_salon_id;
  delete from employee_categories where salon_id = p_salon_id;
  delete from work_schedules where salon_id = p_salon_id;
  update employees set profile_id = null where salon_id = p_salon_id;
  delete from employees where salon_id = p_salon_id;

  -- Catalogo, clientes, plantillas y configuracion del salon.
  delete from notification_templates where salon_id = p_salon_id;
  delete from services where salon_id = p_salon_id;
  delete from service_categories where salon_id = p_salon_id;
  delete from customers where salon_id = p_salon_id;
  delete from salon_business_hours where salon_id = p_salon_id;
  delete from salon_invitations where salon_id = p_salon_id;

  -- RBAC: los perfiles dependen de roles, asi que se quitan antes.
  delete from role_permissions where salon_id = p_salon_id;
  update profiles set role_id = null where salon_id = p_salon_id;
  delete from profiles where salon_id = p_salon_id;
  delete from roles where salon_id = p_salon_id;

  -- Actividad: se borra al final porque los triggers de los borrados anteriores la alimentan.
  delete from salon_activity_log where salon_id = p_salon_id;

  delete from salons where id = p_salon_id;
end;
$$;

revoke execute on function public.delete_salon_completely(uuid) from public, anon, authenticated;
grant execute on function public.delete_salon_completely(uuid) to service_role;

commit;
