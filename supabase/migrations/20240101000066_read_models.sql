-- Fase 5 (READ-MODELS-SQL): agregados de lectura para dashboard y reportes.
--
-- Problema: dashboard y reportes leian filas crudas (citas, items, ventas, gastos, compras, stock)
-- y las sumaban en JS. Con max_rows = 1000 los totales se truncaban, y el coste crecia con el
-- volumen del salon. Estas funciones devuelven los agregados ya calculados en la base, con las
-- mismas definiciones que el dominio TypeScript (cada funcion documenta su origen en el JS).
--
-- Forward-only, expand/contract: no modifica funciones existentes (report_monthly_history sigue
-- disponible). La app puede migrar cada lectura sin cambiar la UI.
--
-- Reglas comunes de todas las funciones:
--   * security invoker: aplican las politicas RLS del usuario que llama (mismo alcance que hoy).
--   * Filtran por public.salon_id() (claim salon_id del JWT o perfil). Sin sesion devuelven ceros/vacio.
--   * search_path fijo (public, pg_temp). EXECUTE solo para authenticated (public, anon y service_role revocados).
--   * La zona horaria del salon llega como parametro p_timezone; la resuelve la app igual que hoy.
--   * Importes en numeric (suma exacta, sin errores de coma flotante). Ratios en float8 como en JS.
--   * Rangos de fechas: p_from/p_to son dias locales inclusivos; los timestamps se acotan con
--     report_day_start (00:00 local) y report_day_end (inicio + 24 h - 1 ms), igual que utcBounds.

begin;

set lock_timeout = '1s';
set statement_timeout = '30s';

-- 1. Indices para los filtros por salon + fecha de los agregados (verificados con EXPLAIN en db2).
-- appointments (salon_id, start_time) y retail_sales (salon_id, sale_date) ya existen.
-- Tablas por salon y poco volumen en esta fase; el indice va dentro de la transaccion de la migracion (atomico con las funciones que lo usan).
create index if not exists idx_items_salon_start
  on public.appointment_items (salon_id, start_time);

-- Tablas por salon y poco volumen en esta fase; el indice va dentro de la transaccion de la migracion (atomico con las funciones que lo usan).
create index if not exists idx_retail_sale_items_salon_created
  on public.retail_sale_items (salon_id, created_at);

-- Tablas por salon y poco volumen en esta fase; el indice va dentro de la transaccion de la migracion (atomico con las funciones que lo usan).
create index if not exists idx_customers_salon_created
  on public.customers (salon_id, created_at);

-- 2. Helpers de calendario (puros, sin datos). Los llaman las funciones de lectura.

-- Inicio (00:00 local) del dia p_date en p_timezone, como instante UTC.
create or replace function public.report_day_start(p_date date, p_timezone text)
returns timestamptz
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select p_date::timestamp at time zone p_timezone
$$;

-- Fin del dia local: medianoche local del dia siguiente menos 1 ms. Coincide con utcBounds (src/lib/utils/dates.ts)
-- salvo en los dias de cambio de horario, donde el JS suma 24 h exactas y se pasa una hora (corregido aqui).
create or replace function public.report_day_end(p_date date, p_timezone text)
returns timestamptz
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select (p_date + 1)::timestamp at time zone p_timezone - interval '1 millisecond'
$$;

-- 3. Items de citas completadas del rango (base de comisiones y desgloses por empleado/servicio).
-- Origen JS: findOperationalReportRows (items) + normalizeItem en src/features/reports/data/reports.repo.ts.
-- price = max(0, price - discount_amount). Nombre de empleado = "nombre apellido" recortado.
-- Left join a empleado y servicio, como el embed de PostgREST: el filtrado de nulos lo hace el llamador.
create or replace function public.report_completed_items(p_start timestamptz, p_end timestamptz)
returns table (
  appointment_id uuid,
  employee_id uuid,
  employee_name text,
  commission_percentage numeric,
  service_id uuid,
  service_name text,
  price numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    i.appointment_id,
    i.employee_id,
    btrim(e.first_name || ' ' || e.last_name),
    e.commission_percentage,
    i.service_id,
    s.name,
    greatest(i.price - i.discount_amount, 0)
  from public.appointment_items i
  join public.appointments a on a.id = i.appointment_id
  left join public.employees e on e.id = i.employee_id
  left join public.services s on s.id = i.service_id
  where i.salon_id = public.salon_id()
    and a.status = 'completed'
    and i.start_time between p_start and p_end
$$;

-- 4. Metricas del dashboard (tarjetas "hoy" y "mes").
-- Origen JS: getDashboardOverview (use-case) + findDashboardReportRows + sumRetailSalesTotal +
-- sumExpensesTotal + sumInventoryPurchasesTotal + findLowStockProductCount.
--   * todayAppointments: citas de cualquier estado con inicio en el dia local de p_now.
--   * Ingresos de citas: completadas desde el inicio del mes local (sin limite superior, como el JS).
--   * Ventas de vitrina: sale_date entre inicio del mes y p_now (inclusive).
--   * Gastos y compras: fechas locales entre el dia 1 del mes y hoy (inclusive).
--   * Clientes: activos (is_active), sin filtrar temporales (como el JS).
--   * Productos bajo stock: productos distintos con alguna ubicacion en cantidad <= 0, o con minimo > 0 y
--     cantidad <= minimo; productos con deleted_at no nulo se excluyen.
create or replace function public.report_dashboard_metrics(
  p_timezone text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_today date := (p_now at time zone p_timezone)::date;
  v_month date := date_trunc('month', p_now at time zone p_timezone)::date;
  v_month_start timestamptz := public.report_day_start(v_month, p_timezone);
  v_appt_today bigint;
  v_completed bigint;
  v_appt_revenue numeric;
  v_retail numeric;
  v_manual numeric;
  v_purchases numeric;
  v_customers bigint;
  v_low_stock bigint;
begin
  select count(*) into v_appt_today
  from appointments a
  where a.salon_id = v_salon
    and a.start_time between public.report_day_start(v_today, p_timezone)
                         and public.report_day_end(v_today, p_timezone);

  select count(*), coalesce(sum(a.total_price), 0)
    into v_completed, v_appt_revenue
  from appointments a
  where a.salon_id = v_salon
    and a.status = 'completed'
    and a.start_time >= v_month_start;

  select coalesce(sum(r.total_amount), 0) into v_retail
  from retail_sales r
  where r.salon_id = v_salon
    and r.sale_date >= v_month_start
    and r.sale_date <= p_now;

  select coalesce(sum(e.amount), 0) into v_manual
  from expenses e
  where e.salon_id = v_salon
    and e.expense_date between v_month and v_today;

  select coalesce(sum(i.total_cost), 0) into v_purchases
  from inventory_purchases i
  where i.salon_id = v_salon
    and i.purchase_date between v_month and v_today;

  select count(*) into v_customers
  from customers c
  where c.salon_id = v_salon
    and c.is_active;

  select count(distinct l.product_id) into v_low_stock
  from inventory_stock_locations l
  join inventory_products pr on pr.id = l.product_id
  where l.salon_id = v_salon
    and pr.salon_id = v_salon
    and pr.deleted_at is null
    and (l.quantity <= 0 or (l.minimum_quantity > 0 and l.quantity <= l.minimum_quantity));

  return jsonb_build_object(
    'todayAppointments', v_appt_today,
    'appointmentRevenue', v_appt_revenue,
    'retailRevenue', v_retail,
    'monthRevenue', v_appt_revenue + v_retail,
    'manualExpenses', v_manual,
    'inventoryPurchases', v_purchases,
    'monthExpenses', v_manual + v_purchases,
    'estimatedProfit', (v_appt_revenue + v_retail) - (v_manual + v_purchases),
    'lowStockProducts', v_low_stock,
    'totalCustomers', v_customers,
    'completedThisMonth', v_completed
  );
end
$$;

-- 5. Serie de 12 meses de citas completadas con tendencia (chart del dashboard).
-- Origen JS: getMonthSequence + calculateMonthlyCompletedAppointments (get-dashboard-overview.ts).
-- El mes mas antiguo compara contra si mismo (delta 0, trend flat). La etiqueta del mes (es-PA) la
-- sigue formateando la app; aqui solo se devuelve monthKey (YYYY-MM) en zona local.
create or replace function public.report_dashboard_monthly_appointments(
  p_timezone text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_first date := (date_trunc('month', p_now at time zone p_timezone) - interval '11 months')::date;
  v_chart_start timestamptz := public.report_day_start(v_first, p_timezone);
begin
  return coalesce((
    with months_q as (
      select to_char(g, 'YYYY-MM') as month_key,
             row_number() over (order by g) as pos
      from generate_series(v_first::timestamp, v_first::timestamp + interval '11 months', interval '1 month') g
    ),
    counts_q as (
      select to_char(a.start_time at time zone p_timezone, 'YYYY-MM') as month_key,
             count(*) as total
      from appointments a
      where a.salon_id = v_salon
        and a.status = 'completed'
        and a.start_time >= v_chart_start
      group by 1
    ),
    series_q as (
      select m.month_key, m.pos, coalesce(c.total, 0) as total
      from months_q m
      left join counts_q c on c.month_key = m.month_key
    ),
    delta_q as (
      select s.month_key, s.pos, s.total,
             s.total - coalesce(prev.total, s.total) as delta
      from series_q s
      left join series_q prev on prev.pos = s.pos - 1
    )
    select jsonb_agg(jsonb_build_object(
      'monthKey', d.month_key,
      'total', d.total,
      'delta', d.delta,
      'trend', case when d.delta > 0 then 'up' when d.delta < 0 then 'down' else 'flat' end
    ) order by d.pos)
    from delta_q d
  ), '[]'::jsonb);
end
$$;

-- 6. Top 5 servicios del mes (dashboard).
-- Origen JS: calculateTopServices. Cuenta items (no citas) de citas que no estan canceladas ni en no_show,
-- agrupados por nombre de servicio, desde el dia 1 del mes local. pct relativo al maximo.
-- Desempate: el JS dependia del orden de filas; aqui es determinista (nombre, collation ICU).
create or replace function public.report_dashboard_top_services(
  p_timezone text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_month_start timestamptz := public.report_day_start(
    date_trunc('month', p_now at time zone p_timezone)::date, p_timezone
  );
begin
  return coalesce((
    with counts_q as (
      select s.name, count(*) as total
      from appointment_items i
      join appointments a on a.id = i.appointment_id
      join services s on s.id = i.service_id
      where i.salon_id = v_salon
        and i.start_time >= v_month_start
        and a.status not in ('cancelled', 'no_show')
        and coalesce(s.name, '') <> ''
      group by s.name
    ),
    ranked_q as (
      select c.name, c.total,
             max(c.total) over () as max_total,
             row_number() over (order by c.total desc, c.name collate "und-x-icu") as pos
      from counts_q c
    )
    select jsonb_agg(jsonb_build_object(
      'name', r.name,
      'count', r.total,
      'pct', r.total::float8 * 100 / r.max_total::float8
    ) order by r.pos)
    from ranked_q r
    where r.pos <= 5
  ), '[]'::jsonb);
end
$$;

-- 7. Totales de un periodo (dia 1 a dia 2 inclusive, en zona del salon).
-- Origen JS: getOperationalReport (periodo y acumulado anual) + calculateOperationalReportMetrics +
-- calculateOperationalMoneyTotals + getReportExportData (totales). Sirve tambien para el acumulado del
-- año (p_from = 1 de enero, p_to = 31 de diciembre) y para el alcance "histórico" (0001-01-01 .. 9999-12-31).
-- p_modules desactiva retail/expenses/inventory igual que el JS (el valor queda en cero).
--   * revenue: suma de total_price de citas completadas (ya neto de descuento en el trigger de items).
--   * discounts: suma de discount_amount de citas completadas.
--   * completedCount / totalCount: citas completadas y de cualquier estado en el rango.
--   * avgTicket = revenue / completedCount. noShowRate = no_show / totalCount * 100 (0 si no hay citas).
--   * newCustomers: clientes no temporales creados en el rango.
create or replace function public.report_period_totals(
  p_from date,
  p_to date,
  p_timezone text,
  p_modules jsonb default '{"inventory": true, "retail": true, "expenses": true}'::jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_start timestamptz := public.report_day_start(p_from, p_timezone);
  v_end timestamptz := public.report_day_end(p_to, p_timezone);
  v_total bigint := 0;
  v_completed bigint := 0;
  v_no_show bigint := 0;
  v_revenue numeric := 0;
  v_discounts numeric := 0;
  v_retail numeric := 0;
  v_manual numeric := 0;
  v_purchases numeric := 0;
  v_new_customers bigint := 0;
begin
  select count(*),
         count(*) filter (where a.status = 'completed'),
         count(*) filter (where a.status = 'no_show'),
         coalesce(sum(a.total_price) filter (where a.status = 'completed'), 0),
         coalesce(sum(a.discount_amount) filter (where a.status = 'completed'), 0)
    into v_total, v_completed, v_no_show, v_revenue, v_discounts
  from appointments a
  where a.salon_id = v_salon
    and a.start_time between v_start and v_end;

  if coalesce((p_modules ->> 'retail')::boolean, true) then
    select coalesce(sum(r.total_amount), 0) into v_retail
    from retail_sales r
    where r.salon_id = v_salon
      and r.sale_date between v_start and v_end;
  end if;

  if coalesce((p_modules ->> 'expenses')::boolean, true) then
    select coalesce(sum(e.amount), 0) into v_manual
    from expenses e
    where e.salon_id = v_salon
      and e.expense_date between p_from and p_to;
  end if;

  if coalesce((p_modules ->> 'inventory')::boolean, true) then
    select coalesce(sum(i.total_cost), 0) into v_purchases
    from inventory_purchases i
    where i.salon_id = v_salon
      and i.purchase_date between p_from and p_to;
  end if;

  select count(*) into v_new_customers
  from customers c
  where c.salon_id = v_salon
    and c.is_temporary = false
    and c.created_at between v_start and v_end;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'revenue', v_revenue,
    'discounts', v_discounts,
    'retailRevenue', v_retail,
    'grossRevenue', v_revenue + v_retail,
    'manualExpenses', v_manual,
    'inventoryPurchases', v_purchases,
    'totalExpenses', v_manual + v_purchases,
    'estimatedProfit', (v_revenue + v_retail) - (v_manual + v_purchases),
    'completedCount', v_completed,
    'totalCount', v_total,
    'avgTicket', case when v_completed > 0 then (v_revenue / v_completed)::float8 else 0 end,
    'noShowRate', case when v_total > 0 then (v_no_show * 100.0 / v_total)::float8 else 0 end,
    'newCustomers', v_new_customers
  );
end
$$;

-- 8. Desgloses del periodo: estados, empleados y servicios.
-- Origen JS: calculateStatusBreakdown, calculateEmployeeBreakdown, calculateServiceBreakdown (metrics.ts).
--   * statusBreakdown: citas de todos los estados; orden cancelled/completed/... del dominio, luego
--     los desconocidos por codigo (como Array.prototype.sort). pct sobre el total de citas del rango.
--   * byEmployee: citas distintas y revenue por empleado (items de citas completadas). pct sobre el maximo.
--   * byService: items por servicio y revenue. Orden: count, revenue, nombre. pct sobre el maximo count.
create or replace function public.report_operational_breakdown(
  p_from date,
  p_to date,
  p_timezone text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_start timestamptz := public.report_day_start(p_from, p_timezone);
  v_end timestamptz := public.report_day_end(p_to, p_timezone);
begin
  return jsonb_build_object(
    'statusBreakdown', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', s.status,
        'count', s.cnt,
        'pct', s.cnt * 100.0 / s.total
      ) order by s.pos)
      from (
        select g.status, g.cnt,
               sum(g.cnt) over () as total,
               row_number() over (
                 order by case g.status
                   when 'completed' then 1
                   when 'confirmed' then 2
                   when 'scheduled' then 3
                   when 'cancelled' then 4
                   when 'no_show' then 5
                   else 6
                 end,
                 g.status collate "C"
               ) as pos
        from (
          select a.status, count(*) as cnt
          from appointments a
          where a.salon_id = v_salon
            and a.start_time between v_start and v_end
          group by a.status
        ) g
      ) s
    ), '[]'::jsonb),
    'byEmployee', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.employee_id,
        'name', b.name,
        'count', b.cnt,
        'revenue', b.revenue,
        'pct', case when b.max_revenue > 0 then b.revenue * 100 / b.max_revenue else 0 end
      ) order by b.revenue desc, b.name collate "und-x-icu")
      from (
        select x.employee_id, x.name, x.cnt, x.revenue,
               max(x.revenue) over () as max_revenue
        from (
          select ci.employee_id,
                 min(ci.employee_name) as name,
                 count(distinct ci.appointment_id) as cnt,
                 sum(ci.price) as revenue
          from public.report_completed_items(v_start, v_end) ci
          where ci.employee_id is not null
            and coalesce(ci.employee_name, '') <> ''
          group by ci.employee_id
        ) x
      ) b
    ), '[]'::jsonb),
    'byService', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.service_id,
        'name', b.name,
        'count', b.cnt,
        'revenue', b.revenue,
        'pct', case when b.max_count > 0 then b.cnt * 100.0 / b.max_count else 0 end
      ) order by b.cnt desc, b.revenue desc, b.name collate "und-x-icu")
      from (
        select x.service_id, x.name, x.cnt, x.revenue,
               max(x.cnt) over () as max_count
        from (
          select ci.service_id,
                 min(ci.service_name) as name,
                 count(*) as cnt,
                 sum(ci.price) as revenue
          from public.report_completed_items(v_start, v_end) ci
          where ci.service_id is not null
            and coalesce(ci.service_name, '') <> ''
          group by ci.service_id
        ) x
      ) b
    ), '[]'::jsonb)
  );
end
$$;

-- 9. Liquidacion de comisiones por empleado.
-- Origen JS: calculateCommissionReport (commissions.ts). Revenue se redondea a 2 decimales antes de
-- calcular la comision: commission = round(revenue_redondeado * pct / 100, 2). Empleados con 0% aparecen.
-- Orden: comision desc, revenue desc, nombre. Totales = suma de las filas ya redondeadas.
create or replace function public.report_commissions(
  p_from date,
  p_to date,
  p_timezone text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz := public.report_day_start(p_from, p_timezone);
  v_end timestamptz := public.report_day_end(p_to, p_timezone);
begin
  return (
    with per_employee_q as (
      select ci.employee_id,
             min(ci.employee_name) as name,
             count(distinct ci.appointment_id) as appointments,
             round(sum(ci.price), 2) as revenue,
             coalesce(min(ci.commission_percentage), 0) as pct
      from public.report_completed_items(v_start, v_end) ci
      where ci.employee_id is not null
        and coalesce(ci.employee_name, '') <> ''
      group by ci.employee_id
    ),
    rows_q as (
      select p.employee_id, p.name, p.appointments, p.revenue, p.pct,
             round(p.revenue * p.pct / 100, 2) as commission
      from per_employee_q p
    )
    select jsonb_build_object(
      'rows', coalesce(jsonb_agg(jsonb_build_object(
        'employeeId', r.employee_id,
        'name', r.name,
        'appointments', r.appointments,
        'revenue', r.revenue,
        'commissionPct', r.pct,
        'commission', r.commission
      ) order by r.commission desc, r.revenue desc, r.name collate "und-x-icu"), '[]'::jsonb),
      'totalRevenue', round(coalesce(sum(r.revenue), 0), 2),
      'totalCommission', round(coalesce(sum(r.commission), 0), 2)
    )
    from rows_q r
  );
end
$$;

-- 10. Historial mensual (serie continua) para graficas y exportacion.
-- Origen JS: calculateHistoricalReportAnalytics (months), buildMonthlyExportRows (filas) y calculateLifetimeTotals.
-- Rango: p_first_month..p_last_month (YYYY-MM, inclusive). Si p_first_month es null, empieza en el primer mes
-- con actividad; si p_last_month es null, termina en el mayor entre el mes actual y el ultimo mes con actividad.
-- Los meses sin movimientos salen en cero. Modulos desactivados ponen su columna en cero (como el JS).
--   * completedAppointments / appointmentRevenue: citas completadas por mes local.
--   * retailRevenue: ventas de vitrina por mes local de sale_date.
--   * operationalExpenses / inventoryPurchases: por mes de expense_date / purchase_date (fechas, no zona).
--   * grossRevenue = appointmentRevenue + retailRevenue (el JS lo llama totalRevenue en las graficas).
--   * profit = grossRevenue - totalExpenses; marginPct = profit / grossRevenue * 100 (0 si no hay ingresos).
create or replace function public.report_monthly_series(
  p_first_month text,
  p_last_month text,
  p_timezone text,
  p_modules jsonb default '{"inventory": true, "retail": true, "expenses": true}'::jsonb,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_retail_on boolean := coalesce((p_modules ->> 'retail')::boolean, true);
  v_expenses_on boolean := coalesce((p_modules ->> 'expenses')::boolean, true);
  v_inventory_on boolean := coalesce((p_modules ->> 'inventory')::boolean, true);
  v_min_activity text;
  v_max_activity text;
  v_first text;
  v_last text;
  v_first_day date;
  v_last_day date;
  v_start timestamptz;
  v_end timestamptz;
begin
  -- Limites de actividad (solo se usan si no llegan p_first_month / p_last_month).
  select min(a.month_key), max(a.month_key)
    into v_min_activity, v_max_activity
  from (
    select to_char(x.start_time at time zone p_timezone, 'YYYY-MM') as month_key
    from appointments x
    where x.salon_id = v_salon and x.status = 'completed'
    union all
    select to_char(r.sale_date at time zone p_timezone, 'YYYY-MM')
    from retail_sales r
    where v_retail_on and r.salon_id = v_salon
    union all
    select to_char(e.expense_date, 'YYYY-MM')
    from expenses e
    where v_expenses_on and e.salon_id = v_salon
    union all
    select to_char(i.purchase_date, 'YYYY-MM')
    from inventory_purchases i
    where v_inventory_on and i.salon_id = v_salon
  ) a;

  v_first := coalesce(p_first_month, v_min_activity);
  if v_first is null then
    return '[]'::jsonb;
  end if;
  v_last := coalesce(p_last_month, greatest(to_char(p_now at time zone p_timezone, 'YYYY-MM'), v_max_activity));

  v_first_day := to_date(v_first || '-01', 'YYYY-MM-DD');
  v_last_day := (to_date(v_last || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;
  v_start := public.report_day_start(v_first_day, p_timezone);
  v_end := public.report_day_end(v_last_day, p_timezone);

  return coalesce((
    with months_q as (
      select to_char(g, 'YYYY-MM') as month_key,
             row_number() over (order by g) as pos
      from generate_series(v_first_day::timestamp, v_last_day::timestamp, interval '1 month') g
    ),
    appt_m as (
      select to_char(a.start_time at time zone p_timezone, 'YYYY-MM') as month_key,
             count(*) as cnt,
             sum(a.total_price) as revenue
      from appointments a
      where a.salon_id = v_salon
        and a.status = 'completed'
        and a.start_time between v_start and v_end
      group by 1
    ),
    retail_m as (
      select to_char(r.sale_date at time zone p_timezone, 'YYYY-MM') as month_key,
             sum(r.total_amount) as amount
      from retail_sales r
      where v_retail_on
        and r.salon_id = v_salon
        and r.sale_date between v_start and v_end
      group by 1
    ),
    exp_m as (
      select to_char(e.expense_date, 'YYYY-MM') as month_key,
             sum(e.amount) as amount
      from expenses e
      where v_expenses_on
        and e.salon_id = v_salon
        and e.expense_date between v_first_day and v_last_day
      group by 1
    ),
    purch_m as (
      select to_char(i.purchase_date, 'YYYY-MM') as month_key,
             sum(i.total_cost) as amount
      from inventory_purchases i
      where v_inventory_on
        and i.salon_id = v_salon
        and i.purchase_date between v_first_day and v_last_day
      group by 1
    ),
    base_q as (
      select m.month_key, m.pos,
             coalesce(a.cnt, 0) as cnt,
             coalesce(a.revenue, 0) as appt_revenue,
             coalesce(r.amount, 0) as retail,
             coalesce(x.amount, 0) as expenses,
             coalesce(p.amount, 0) as purchases
      from months_q m
      left join appt_m a on a.month_key = m.month_key
      left join retail_m r on r.month_key = m.month_key
      left join exp_m x on x.month_key = m.month_key
      left join purch_m p on p.month_key = m.month_key
    )
    select jsonb_agg(jsonb_build_object(
      'monthKey', b.month_key,
      'completedAppointments', b.cnt,
      'appointmentRevenue', b.appt_revenue,
      'retailRevenue', b.retail,
      'grossRevenue', b.appt_revenue + b.retail,
      'operationalExpenses', b.expenses,
      'inventoryPurchases', b.purchases,
      'totalExpenses', b.expenses + b.purchases,
      'profit', (b.appt_revenue + b.retail) - (b.expenses + b.purchases),
      'marginPct', case when (b.appt_revenue + b.retail) > 0
        then ((b.appt_revenue + b.retail) - (b.expenses + b.purchases))::float8 * 100 / (b.appt_revenue + b.retail)::float8
        else 0 end
    ) order by b.pos)
    from base_q b
  ), '[]'::jsonb);
end
$$;

-- 11. Franjas horarias con mas citas (grafica de horas ocupadas).
-- Origen JS: busyHours del RPC report_monthly_history, agregado en la base. Excluye cancelled y no_show.
-- Hora = hora local del salon (0-23), orden ascendente.
create or replace function public.report_busy_hours(
  p_from date,
  p_to date,
  p_timezone text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_start timestamptz := public.report_day_start(p_from, p_timezone);
  v_end timestamptz := public.report_day_end(p_to, p_timezone);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('hour', h.hour_of_day, 'total', h.total) order by h.hour_of_day)
    from (
      select extract(hour from a.start_time at time zone p_timezone)::int as hour_of_day,
             count(*) as total
      from appointments a
      where a.salon_id = v_salon
        and a.status not in ('cancelled', 'no_show')
        and a.start_time between v_start and v_end
      group by 1
    ) h
  ), '[]'::jsonb);
end
$$;

-- 12. Gastos agrupados por concepto (top gastos y exportacion).
-- Origen JS: expenseGroups del RPC report_monthly_history + calculateHistoricalReportAnalytics (topExpenses)
-- y getReportExportData (expenseConcepts).
--   * Etiqueta = concepto, o categoria personalizada, o categoria, o "Otros gastos" (mismo orden que el RPC).
--   * p_include_restock = true anade "Reposiciones de inventario" con el total de compras del rango
--     (solo si el total es > 0, como el JS).
--   * p_limit: top N (null = todos). Orden: importe desc, etiqueta.
--   * Diferencia documentada: si un gasto ya se llama "Reposiciones de inventario", el JS sobrescribia el
--     importe; aqui se suman.
create or replace function public.report_expense_concepts(
  p_from date,
  p_to date,
  p_modules jsonb default '{"inventory": true, "retail": true, "expenses": true}'::jsonb,
  p_include_restock boolean default false,
  p_limit integer default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_expenses_on boolean := coalesce((p_modules ->> 'expenses')::boolean, true);
  v_inventory_on boolean := coalesce((p_modules ->> 'inventory')::boolean, true);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('label', g.label, 'amount', g.amount) order by g.amount desc, g.label collate "und-x-icu")
    from (
      select c.label, sum(c.amount) as amount
      from (
        select coalesce(nullif(e.concept, ''), nullif(e.custom_category, ''), e.category, 'Otros gastos') as label,
               e.amount
        from expenses e
        where v_expenses_on
          and e.salon_id = v_salon
          and e.expense_date between p_from and p_to
        union all
        select 'Reposiciones de inventario'::text, i.total_cost
        from inventory_purchases i
        where p_include_restock
          and v_inventory_on
          and i.salon_id = v_salon
          and i.purchase_date between p_from and p_to
      ) c
      group by c.label
      having sum(c.amount) > 0
      order by sum(c.amount) desc, c.label collate "und-x-icu"
      limit p_limit
    ) g
  ), '[]'::jsonb);
end
$$;

-- 13. Productos mas vendidos en vitrina (top N) con cantidad por mes.
-- Origen JS: productMonths del RPC report_monthly_history (+ calculateHistoricalReportAnalytics.productSales).
-- Filtra items por created_at dentro del rango de meses (como el RPC) y agrupa el mes por sale_date local.
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
        and si.created_at between v_start and v_end
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

-- 14. Alertas de inventario (agotado / bajo) por producto, agregando sus ubicaciones.
-- Origen JS: calculateHistoricalReportAnalytics -> inventoryAlert (y findHistoricalReportRows).
--   * Solo productos activos y no borrados. total = retail + internal + storage; minimum = suma de minimos.
--   * agotado: total <= 0. bajo: total <= minimum. Solo se devuelven estos dos estados.
--   * Orden: total asc, nombre. Con modulo inventory desactivado devuelve vacio.
create or replace function public.report_inventory_alerts(
  p_modules jsonb default '{"inventory": true, "retail": true, "expenses": true}'::jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
begin
  if not coalesce((p_modules ->> 'inventory')::boolean, true) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    with stock_q as (
      select pr.id,
             pr.name,
             coalesce(sum(l.quantity) filter (where l.location = 'retail'), 0) as retail,
             coalesce(sum(l.quantity) filter (where l.location = 'internal'), 0) as internal,
             coalesce(sum(l.quantity) filter (where l.location = 'storage'), 0) as storage,
             coalesce(sum(l.minimum_quantity), 0) as minimum
      from inventory_products pr
      left join inventory_stock_locations l
        on l.product_id = pr.id
       and l.salon_id = v_salon
      where pr.salon_id = v_salon
        and pr.is_active
        and pr.deleted_at is null
      group by pr.id, pr.name
    ),
    alerts_q as (
      select s.id, s.name, s.retail, s.internal, s.storage,
             s.retail + s.internal + s.storage as total,
             s.minimum,
             case
               when s.retail + s.internal + s.storage <= 0 then 'agotado'
               when s.retail + s.internal + s.storage <= s.minimum then 'bajo'
               else 'disponible'
             end as state
      from stock_q s
    )
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'name', a.name,
      'retail', a.retail,
      'internal', a.internal,
      'storage', a.storage,
      'total', a.total,
      'minimum', a.minimum,
      'state', a.state
    ) order by a.total asc, a.name collate "und-x-icu")
    from alerts_q a
    where a.state <> 'disponible'
  ), '[]'::jsonb);
end
$$;

-- 4. Matriz de EXECUTE: solo authenticated (cliente de usuario). Sin public, anon ni service_role.
revoke all on function public.report_day_start(date, text) from public, anon, service_role;
revoke all on function public.report_day_end(date, text) from public, anon, service_role;
revoke all on function public.report_completed_items(timestamptz, timestamptz) from public, anon, service_role;
revoke all on function public.report_dashboard_metrics(text, timestamptz) from public, anon, service_role;
revoke all on function public.report_dashboard_monthly_appointments(text, timestamptz) from public, anon, service_role;
revoke all on function public.report_dashboard_top_services(text, timestamptz) from public, anon, service_role;
revoke all on function public.report_period_totals(date, date, text, jsonb) from public, anon, service_role;
revoke all on function public.report_operational_breakdown(date, date, text) from public, anon, service_role;
revoke all on function public.report_commissions(date, date, text) from public, anon, service_role;
revoke all on function public.report_monthly_series(text, text, text, jsonb, timestamptz) from public, anon, service_role;
revoke all on function public.report_busy_hours(date, date, text) from public, anon, service_role;
revoke all on function public.report_expense_concepts(date, date, jsonb, boolean, integer) from public, anon, service_role;
revoke all on function public.report_product_sales(text, text, text, jsonb, integer) from public, anon, service_role;
revoke all on function public.report_inventory_alerts(jsonb) from public, anon, service_role;

grant execute on function public.report_day_start(date, text) to authenticated;
grant execute on function public.report_day_end(date, text) to authenticated;
grant execute on function public.report_completed_items(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_dashboard_metrics(text, timestamptz) to authenticated;
grant execute on function public.report_dashboard_monthly_appointments(text, timestamptz) to authenticated;
grant execute on function public.report_dashboard_top_services(text, timestamptz) to authenticated;
grant execute on function public.report_period_totals(date, date, text, jsonb) to authenticated;
grant execute on function public.report_operational_breakdown(date, date, text) to authenticated;
grant execute on function public.report_commissions(date, date, text) to authenticated;
grant execute on function public.report_monthly_series(text, text, text, jsonb, timestamptz) to authenticated;
grant execute on function public.report_busy_hours(date, date, text) to authenticated;
grant execute on function public.report_expense_concepts(date, date, jsonb, boolean, integer) to authenticated;
grant execute on function public.report_product_sales(text, text, text, jsonb, integer) to authenticated;
grant execute on function public.report_inventory_alerts(jsonb) to authenticated;

commit;
