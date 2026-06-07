alter table public.customers
add column if not exists search_name text
generated always as (
  lower(btrim(first_name) || ' ' || btrim(last_name))
) stored;

create index if not exists customers_salon_active_search_name_idx
on public.customers (salon_id, is_active, is_temporary, search_name, id);
