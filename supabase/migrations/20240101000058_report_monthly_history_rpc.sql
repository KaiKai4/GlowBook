-- Historico de reportes agregado en SQL: antes el backend traia 12 meses de
-- filas crudas (citas, ventas, gastos, compras, items) y sumaba en JS, lo que
-- crece sin limite con el volumen del salon. Esta funcion devuelve los buckets
-- ya agregados; el bucketing por mes/hora se hace en la zona horaria del salon.
-- security invoker: las politicas RLS del usuario que consulta siguen aplicando
-- (aislamiento por salon y visibilidad por colaborador identicos a las queries
-- directas que reemplaza).
create or replace function public.report_monthly_history(
  p_salon_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_timezone text
) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'appointmentMonths', coalesce((
      select jsonb_agg(jsonb_build_object(
        'monthKey', month_key,
        'completedRevenue', completed_revenue,
        'completedCount', completed_count
      ) order by month_key)
      from (
        select
          to_char(start_time at time zone p_timezone, 'YYYY-MM') as month_key,
          sum(total_price)::float8 as completed_revenue,
          count(*) as completed_count
        from appointments
        where salon_id = p_salon_id
          and status = 'completed'
          and start_time >= p_start and start_time <= p_end
        group by 1
      ) appointment_months
    ), '[]'::jsonb),
    'busyHours', coalesce((
      select jsonb_agg(jsonb_build_object('hour', hour, 'total', total) order by hour)
      from (
        select
          extract(hour from start_time at time zone p_timezone)::int as hour,
          count(*) as total
        from appointments
        where salon_id = p_salon_id
          and status not in ('cancelled', 'no_show')
          and start_time >= p_start and start_time <= p_end
        group by 1
      ) busy_hours
    ), '[]'::jsonb),
    'retailMonths', coalesce((
      select jsonb_agg(jsonb_build_object('monthKey', month_key, 'amount', amount) order by month_key)
      from (
        select
          to_char(sale_date at time zone p_timezone, 'YYYY-MM') as month_key,
          sum(total_amount)::float8 as amount
        from retail_sales
        where salon_id = p_salon_id
          and sale_date >= p_start and sale_date <= p_end
        group by 1
      ) retail_months
    ), '[]'::jsonb),
    'expenseGroups', coalesce((
      select jsonb_agg(jsonb_build_object('monthKey', month_key, 'label', label, 'amount', amount))
      from (
        select
          to_char(expense_date, 'YYYY-MM') as month_key,
          coalesce(nullif(concept, ''), nullif(custom_category, ''), category, 'Otros gastos') as label,
          sum(amount)::float8 as amount
        from expenses
        where salon_id = p_salon_id
          and expense_date >= p_start::date and expense_date <= p_end::date
        group by 1, 2
      ) expense_groups
    ), '[]'::jsonb),
    'purchaseMonths', coalesce((
      select jsonb_agg(jsonb_build_object('monthKey', month_key, 'amount', amount) order by month_key)
      from (
        select
          to_char(purchase_date, 'YYYY-MM') as month_key,
          sum(total_cost)::float8 as amount
        from inventory_purchases
        where salon_id = p_salon_id
          and purchase_date >= p_start::date and purchase_date <= p_end::date
        group by 1
      ) purchase_months
    ), '[]'::jsonb),
    'productMonths', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId', product_id,
        'productName', product_name,
        'monthKey', month_key,
        'quantity', quantity
      ))
      from (
        select
          products.id as product_id,
          products.name as product_name,
          to_char(sales.sale_date at time zone p_timezone, 'YYYY-MM') as month_key,
          sum(items.quantity)::float8 as quantity
        from retail_sale_items items
        join inventory_products products on products.id = items.product_id
        join retail_sales sales on sales.id = items.sale_id
        where items.salon_id = p_salon_id
          and items.created_at >= p_start and items.created_at <= p_end
        group by 1, 2, 3
      ) product_months
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.report_monthly_history(uuid, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.report_monthly_history(uuid, timestamptz, timestamptz, text)
  to authenticated, service_role;
