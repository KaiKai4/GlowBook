-- F02-2: totales del mes de gastos calculados en la base.
--
-- Problema: getExpensesPage sumaba en JS la lista de findExpenses, que tiene limit = 40. Con mas de
-- 40 gastos en el mes, el total del mes y el desglose por categoria salian truncados.
--
-- Solucion: esta funcion agrega en Postgres, sin limite, con las mismas reglas que el dominio JS:
--   * gastos manuales de expenses agrupados por category y custom_category (expense_date en rango);
--   * compras de inventario (inventory_purchases.total_cost, purchase_date en rango) como 'products'
--     con custom_category null, igual que el caso de uso (categoria "Productos e insumos").
--
-- Forward-only, expand/contract: funcion nueva aditiva; no modifica funciones existentes.
--
-- Reglas comunes:
--   * security invoker: aplican las politicas RLS del usuario que llama.
--   * Filtra por p_salon_id (regla de la casa: filtro explicito por salon, ademas de RLS).
--   * search_path fijo (public, pg_temp). EXECUTE solo para authenticated.
--   * p_from/p_to son dias locales inclusivos; los llama la app con el mes calendario en curso.

begin;

set lock_timeout = '1s';
set statement_timeout = '30s';

create or replace function public.report_expense_month_totals(
  p_salon_id uuid,
  p_from date,
  p_to date
)
returns table (
  category text,
  custom_category text,
  amount numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select t.category, t.custom_category, sum(t.amount)
  from (
    select e.category, e.custom_category, e.amount
    from public.expenses e
    where e.salon_id = p_salon_id
      and e.expense_date between p_from and p_to
    union all
    select 'products'::text, null::text, i.total_cost
    from public.inventory_purchases i
    where i.salon_id = p_salon_id
      and i.purchase_date between p_from and p_to
  ) t
  group by t.category, t.custom_category
$$;

revoke all on function public.report_expense_month_totals(uuid, date, date) from public, anon, service_role;
grant execute on function public.report_expense_month_totals(uuid, date, date) to authenticated;

commit;
