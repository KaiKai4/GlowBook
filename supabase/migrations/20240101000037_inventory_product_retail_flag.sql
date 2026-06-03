alter table public.inventory_products
  add column if not exists is_retail_enabled boolean not null default true;

create index if not exists idx_inventory_products_salon_retail_enabled
  on public.inventory_products(salon_id, is_retail_enabled);
