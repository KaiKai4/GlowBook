-- Consolida los contadores de uso del plan en una sola llamada: antes cada
-- metrica con limite ejecutaba su propio count (N round-trips por request).
-- El backend calcula las ventanas de ciclo (logica de negocio) y esta funcion
-- solo cuenta; recibe [{ key, counter, from, to }] y devuelve { key: count }.
create or replace function public.count_salon_usage(p_salon_id uuid, p_counters jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  item jsonb;
  result jsonb := '{}'::jsonb;
  v_count bigint;
  v_from timestamptz;
  v_to timestamptz;
begin
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

-- Solo el backend (service_role) consulta uso: sin acceso desde el browser.
revoke execute on function public.count_salon_usage(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.count_salon_usage(uuid, jsonb) to service_role;
