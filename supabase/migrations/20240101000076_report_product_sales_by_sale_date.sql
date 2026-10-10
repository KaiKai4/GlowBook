-- Corrige report_product_sales: filtra las ventas de vitrina por la fecha de venta de la cabecera
-- (retail_sales.sale_date) y no por la fecha de registro de la linea (retail_sale_items.created_at).
--
-- Problema: una venta de junio registrada el 3 de julio quedaba fuera del ranking de junio, y una
-- venta de hoy registrada con retraso podia contarse en un rango equivocado. El mes ya se agrupaba
-- por sale_date; el rango debe usar la misma columna.
--
-- Forward-only (AGENTS.md §11): CREATE OR REPLACE con la misma firma, seguridad, search_path y
-- grants que la version de 20240101000066_read_models.sql. Solo cambia el filtro de fechas.

set lock_timeout = '2s';
set statement_timeout = '30s';

-- 13. Productos mas vendidos en vitrina (top N) con cantidad por mes.
-- Origen JS: productMonths del RPC report_monthly_history (+ calculateHistoricalReportAnalytics.productSales).
-- Filtra por la fecha de venta de la cabecera (sale_date) dentro del rango de meses, en la zona horaria
-- del salon, igual que el mes; el registro de la linea (created_at) no influye en el periodo.
-- months: una cantidad por cada mes del rango, en orden, con 0 cuando no hubo ventas.
-- Orden: total desc, nombre.
create or replace function public.report_product_sales(
  p_first_month text,
  p_last_month text,
  p_timezone text,
  p_modules jsonb default '{"inventory": true, "retail": true, "expenses": true}'::jsonb,
  p_limit integer default 5
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_first_day date := to_date(p_first_month || '-01', 'YYYY-MM-DD');
  v_last_day date := (to_date(p_last_month || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;
  v_start timestamptz := public.report_day_start(v_first_day, p_timezone);
  v_end timestamptz := public.report_day_end(v_last_day, p_timezone);
begin
  if not coalesce((p_modules ->> 'retail')::boolean, true) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    with sold_q as (
      select pr.id as product_id,
             min(pr.name) as product_name,
             to_char(s.sale_date at time zone p_timezone, 'YYYY-MM') as month_key,
             sum(si.quantity) as quantity
      from retail_sale_items si
      join retail_sales s on s.id = si.sale_id
      join inventory_products pr on pr.id = si.product_id
      where si.salon_id = v_salon
        and s.sale_date between v_start and v_end
        and to_char(s.sale_date at time zone p_timezone, 'YYYY-MM') between p_first_month and p_last_month
      group by pr.id, to_char(s.sale_date at time zone p_timezone, 'YYYY-MM')
    ),
    totals_q as (
      select sq.product_id, min(sq.product_name) as name, sum(sq.quantity) as total
      from sold_q sq
      group by sq.product_id
    ),
    top_q as (
      select t.product_id, t.name, t.total
      from totals_q t
      order by t.total desc, t.name collate "und-x-icu"
      limit p_limit
    ),
    months_q as (
      select to_char(g, 'YYYY-MM') as month_key,
             row_number() over (order by g) as pos
      from generate_series(v_first_day::timestamp, v_last_day::timestamp, interval '1 month') g
    )
    select jsonb_agg(jsonb_build_object(
      'id', t.product_id,
      'name', t.name,
      'total', t.total,
      'months', (
        select jsonb_agg(coalesce(sq.quantity, 0) order by m.pos)
        from months_q m
        left join sold_q sq on sq.product_id = t.product_id and sq.month_key = m.month_key
      )
    ) order by t.total desc, t.name collate "und-x-icu")
    from top_q t
  ), '[]'::jsonb);
end
$$;

-- Matriz de EXECUTE de la funcion (la misma que en 20240101000066): solo authenticated.
revoke all on function public.report_product_sales(text, text, text, jsonb, integer) from public, anon, service_role;
grant execute on function public.report_product_sales(text, text, text, jsonb, integer) to authenticated;
