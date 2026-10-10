-- F05-C1: billing con RLS para inquilinos (cliente del usuario) en lugar de service_role.
--
-- Problema: los repos de billing leen con service_role datos del propio salon. Para pasarlos a RLS
-- hay que cerrar antes tres hallazgos de 18_platform_rls.sql:
--   1. Los miembros del salon leian overrides, alertas y pagos completos (motivo, notas, importes).
--   2. commercial_plans era visible en borrador para cualquier autenticado, y ocultaba el plan
--      ARCHIVADO que un salon aun tenia asignado (rompia su plan efectivo con RLS).
--   3. commercial_plan_modules y commercial_plan_limits usaban "using (... or true)": legibles por anon.
--
-- Solucion:
--   * commercial_plans: el plan se ve si es admin de plataforma, si esta activo o si es el plan
--     asignado al salon (aunque este archivado). Los borradores solo los ve la plataforma.
--   * Tablas hijas del plan: solo authenticated y solo si el plan es visible (regla anterior).
--   * salon_plan_payments: solo administracion de plataforma.
--   * salon_plan_overrides y salon_plan_alerts: el salon solo lee las columnas que necesita el
--     calculo de plan efectivo y el aviso de alerta. Motivo, notas, precio especial y regalo quedan fuera.
--   * count_salon_usage: security definer (cuenta aunque la RLS del llamante oculte filas) con guarda:
--     solo su propio salon o plataforma. service_role conserva el acceso sin guarda (backend admin).
--   * salon_plan_assignments: SELECT de tabla revocado; el salon lee solo columnas de facturacion.
--     notes queda interna. La politica por salon_id se mantiene.
--   * commercial_addons, commercial_limit_metrics y platform_modules: lectura solo para authenticated.
--   * record_plan_alert: RPC security definer que crea alertas solo para el salon de la sesion.
--
-- Forward-only (ADR 0016): no cambia datos ni tablas, solo politicas, grants y funciones.

begin;

set lock_timeout = '5s';
set statement_timeout = '60s';

-- 1. Planes comerciales visibles para authenticated: plataforma, activos y el asignado al salon.
drop policy if exists commercial_plans_select on commercial_plans;
create policy commercial_plans_select on commercial_plans for select to authenticated
  using (
    (select public.is_platform_admin())
    or status = 'active'
    or id in (
      select a.plan_id from salon_plan_assignments a
      where a.salon_id = (select public.salon_id())
    )
  );

-- 2. Tablas hijas del plan: solo si el plan padre es visible para el usuario (RLS del padre aplica).
drop policy if exists commercial_plan_modules_select on commercial_plan_modules;
create policy commercial_plan_modules_select on commercial_plan_modules for select to authenticated
  using (plan_id in (select p.id from commercial_plans p));

drop policy if exists commercial_plan_limits_select on commercial_plan_limits;
create policy commercial_plan_limits_select on commercial_plan_limits for select to authenticated
  using (plan_id in (select p.id from commercial_plans p));

-- 3. Pagos: solo administracion de plataforma. Un salon no los necesita.
drop policy if exists salon_plan_payments_select on salon_plan_payments;
create policy salon_plan_payments_select on salon_plan_payments for select to authenticated
  using ((select public.is_platform_admin()));

-- 4. Overrides y alertas: columnas minimas por salon. La politica por salon_id se mantiene.
-- Fuera de overrides: reason (motivo interno), price_override (importe) e is_gift (regalo comercial).
revoke select on salon_plan_overrides from anon, authenticated;
grant select (
  id, salon_id, module_key, metric_key, module_enabled, max_delta, max_override,
  enforcement_mode, warning_threshold, starts_at, ends_at, status, addon_id, quantity
) on salon_plan_overrides to authenticated;

revoke select on salon_plan_alerts from anon, authenticated;
grant select (
  id, salon_id, plan_id, metric_key, module_key, severity, message, status, created_at
) on salon_plan_alerts to authenticated;

-- 4b. Asignacion del salon: notes es interna. El salon lee solo las columnas de facturacion.
revoke select on salon_plan_assignments from anon, authenticated;
grant select (
  id, salon_id, plan_id, status, starts_at, ends_at, trial_ends_at,
  current_period_start, current_period_end, created_at, updated_at
) on salon_plan_assignments to authenticated;

-- 4c. Catalogos: solo authenticated (la politica sin "to" dejaba leer a anon).
drop policy if exists commercial_addons_select on commercial_addons;
create policy commercial_addons_select on commercial_addons for select to authenticated
  using (status <> 'archived' or (select public.is_platform_admin()));

drop policy if exists commercial_limit_metrics_select on commercial_limit_metrics;
create policy commercial_limit_metrics_select on commercial_limit_metrics for select to authenticated
  using (not is_archived or (select public.is_platform_admin()));

drop policy if exists platform_modules_select on platform_modules;
create policy platform_modules_select on platform_modules for select to authenticated
  using (not is_archived or (select public.is_platform_admin()));

-- 5. count_salon_usage: security definer para que el conteo no dependa de la RLS del llamante
-- (un miembro sin permiso de lectura vería menos filas y podría saltarse un límite del plan).
-- La guarda interna es la autoridad. Firma y search_path fijados.
create or replace function public.count_salon_usage(p_salon_id uuid, p_counters jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  item jsonb;
  result jsonb := '{}'::jsonb;
  v_count bigint;
  v_from timestamptz;
  v_to timestamptz;
begin
  -- service_role (backend admin) no se acota: se comprueba primero para no evaluar
  -- public.salon_id() con ese rol. Un usuario solo cuenta su propio salon o es plataforma.
  if (select auth.role()) is distinct from 'service_role' then
    if not (
      p_salon_id = (select public.salon_id())
      or (select public.is_platform_admin())
    ) then
      raise exception 'Sin acceso al uso de otro salon' using errcode = '42501';
    end if;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_counters, '[]'::jsonb)) loop
    v_from := nullif(item->>'from', '')::timestamptz;
    v_to   := nullif(item->>'to', '')::timestamptz;

    case item->>'counter'
      when 'appointments_total' then
        select count(*) into v_count from appointments
          where salon_id = p_salon_id
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'customers_active' then
        select count(*) into v_count from customers
          where salon_id = p_salon_id and is_active = true
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'employees_active' then
        select count(*) into v_count from employees
          where salon_id = p_salon_id and is_active = true
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'login_users_total' then
        select count(*) into v_count from profiles
          where salon_id = p_salon_id and is_active = true
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'services_active' then
        select count(*) into v_count from services
          where salon_id = p_salon_id and is_active = true
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'retail_sales_total' then
        select count(*) into v_count from retail_sales
          where salon_id = p_salon_id
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'inventory_products_active' then
        select count(*) into v_count from inventory_products
          where salon_id = p_salon_id and is_active = true
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'inventory_movements_total' then
        select count(*) into v_count from inventory_movements
          where salon_id = p_salon_id
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      when 'expenses_total' then
        select count(*) into v_count from expenses
          where salon_id = p_salon_id
            and (v_from is null or created_at >= v_from)
            and (v_to is null or created_at < v_to);
      else
        v_count := 0;
    end case;

    result := result || jsonb_build_object(item->>'key', v_count);
  end loop;

  return result;
end $$;

revoke execute on function public.count_salon_usage(uuid, jsonb) from public, anon;
grant execute on function public.count_salon_usage(uuid, jsonb) to authenticated, service_role;

-- 6. record_plan_alert: el aviso siempre se crea para el salon del claim de la sesion.
-- No recibe salon_id: un usuario no puede crear alertas para otro salon.
create or replace function public.record_plan_alert(
  p_plan_id uuid,
  p_metric_key text,
  p_module_key text,
  p_severity text,
  p_message text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_salon uuid := public.salon_id();
  v_id uuid;
begin
  if v_salon is null then
    raise exception 'La sesion no tiene salon' using errcode = '42501';
  end if;

  insert into salon_plan_alerts (salon_id, plan_id, metric_key, module_key, severity, message)
  values (v_salon, p_plan_id, p_metric_key, p_module_key, p_severity, p_message)
  returning id into v_id;

  return v_id;
end $$;

revoke execute on function public.record_plan_alert(uuid, text, text, text, text) from public, anon;
grant execute on function public.record_plan_alert(uuid, text, text, text, text) to authenticated;

commit;
