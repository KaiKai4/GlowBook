alter table inventory_products
  add column if not exists deleted_at timestamptz;

alter table inventory_products
  drop constraint if exists inventory_products_unique_name;

create unique index if not exists inventory_products_unique_active_name
  on inventory_products (salon_id, lower(trim(name)))
  where deleted_at is null;
