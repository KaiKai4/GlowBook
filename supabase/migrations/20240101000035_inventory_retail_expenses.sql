-- Inventory, retail sales and expenses.

insert into permissions (key, description) values
  ('inventory.manage', 'Gestionar inventario y movimientos de stock'),
  ('retail.manage', 'Registrar ventas de vitrina'),
  ('expenses.manage', 'Registrar gastos del salon')
on conflict (key) do update set description = excluded.description;

alter table salons drop constraint if exists salons_disabled_features_allowed;

update salons
set disabled_features = (
  select coalesce(array_agg(distinct feature), '{}'::text[])
  from unnest(disabled_features) as disabled_feature(feature)
  where feature = any (
    array[
      'appointments',
      'recordatorios',
      'customers',
      'employees',
      'services',
      'reports',
      'roles',
      'plantillas',
      'salon',
      'inventory',
      'retail',
      'expenses'
    ]::text[]
  )
);

alter table salons
  add constraint salons_disabled_features_allowed
  check (
    array_position(disabled_features, null) is null
    and disabled_features <@ array[
      'appointments',
      'recordatorios',
      'customers',
      'employees',
      'services',
      'reports',
      'roles',
      'plantillas',
      'salon',
      'inventory',
      'retail',
      'expenses'
    ]::text[]
  );

create table if not exists inventory_products (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  category text,
  cost_price numeric(10,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(10,2) not null default 0 check (sale_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_products_name_not_blank check (length(trim(name)) > 0),
  constraint inventory_products_unique_name unique (salon_id, name)
);

create table if not exists inventory_stock_locations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  product_id uuid not null references inventory_products(id) on delete cascade,
  location text not null check (location in ('retail', 'internal', 'storage')),
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  minimum_quantity numeric(12,2) not null default 0 check (minimum_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_stock_locations_unique unique (product_id, location)
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  product_id uuid not null references inventory_products(id) on delete cascade,
  location text not null check (location in ('retail', 'internal', 'storage')),
  movement_type text not null check (
    movement_type in (
      'initial',
      'purchase',
      'retail_sale',
      'internal_use',
      'adjustment',
      'transfer_in',
      'transfer_out'
    )
  ),
  quantity_delta numeric(12,2) not null,
  quantity_after numeric(12,2) not null check (quantity_after >= 0),
  reference_type text,
  reference_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists inventory_purchases (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  supplier_name text,
  purchase_date date not null default current_date,
  total_cost numeric(12,2) not null default 0 check (total_cost >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_purchase_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  purchase_id uuid not null references inventory_purchases(id) on delete cascade,
  product_id uuid not null references inventory_products(id) on delete restrict,
  location text not null check (location in ('retail', 'internal', 'storage')),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_cost numeric(10,2) not null default 0 check (unit_cost >= 0),
  total_cost numeric(12,2) not null default 0 check (total_cost >= 0),
  created_at timestamptz not null default now()
);

create table if not exists retail_sales (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  sale_date timestamptz not null default now(),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'card', 'transfer', 'yappy', 'other')),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists retail_sale_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  sale_id uuid not null references retail_sales(id) on delete cascade,
  product_id uuid not null references inventory_products(id) on delete restrict,
  location text not null check (location in ('retail', 'internal', 'storage')),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(10,2) not null default 0 check (unit_price >= 0),
  total_price numeric(12,2) not null default 0 check (total_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  expense_date date not null default current_date,
  category text not null check (category in ('rent', 'utilities', 'supplies', 'payroll', 'maintenance', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  vendor text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_inventory_products_updated_at before update on inventory_products
  for each row execute function set_updated_at();
create trigger trg_inventory_stock_locations_updated_at before update on inventory_stock_locations
  for each row execute function set_updated_at();
create trigger trg_inventory_purchases_updated_at before update on inventory_purchases
  for each row execute function set_updated_at();
create trigger trg_retail_sales_updated_at before update on retail_sales
  for each row execute function set_updated_at();
create trigger trg_expenses_updated_at before update on expenses
  for each row execute function set_updated_at();

create index if not exists idx_inventory_products_salon on inventory_products(salon_id);
create index if not exists idx_inventory_stock_locations_salon on inventory_stock_locations(salon_id);
create index if not exists idx_inventory_stock_locations_product on inventory_stock_locations(product_id);
create index if not exists idx_inventory_movements_salon_created on inventory_movements(salon_id, created_at desc);
create index if not exists idx_inventory_purchases_salon_date on inventory_purchases(salon_id, purchase_date desc);
create index if not exists idx_retail_sales_salon_date on retail_sales(salon_id, sale_date desc);
create index if not exists idx_expenses_salon_date on expenses(salon_id, expense_date desc);

alter table inventory_products enable row level security;
alter table inventory_stock_locations enable row level security;
alter table inventory_movements enable row level security;
alter table inventory_purchases enable row level security;
alter table inventory_purchase_items enable row level security;
alter table retail_sales enable row level security;
alter table retail_sale_items enable row level security;
alter table expenses enable row level security;

drop policy if exists inventory_products_select on inventory_products;
create policy inventory_products_select on inventory_products for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('retail.manage'))
      or (select public.has_permission('reports.view'))
    )
  );
drop policy if exists inventory_products_write on inventory_products;
create policy inventory_products_write on inventory_products for all
  using (salon_id = (select public.salon_id()) and (select public.has_permission('inventory.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('inventory.manage')));

drop policy if exists inventory_stock_locations_select on inventory_stock_locations;
create policy inventory_stock_locations_select on inventory_stock_locations for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('retail.manage'))
      or (select public.has_permission('reports.view'))
    )
  );
drop policy if exists inventory_stock_locations_write on inventory_stock_locations;
create policy inventory_stock_locations_write on inventory_stock_locations for all
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('retail.manage'))
    )
  )
  with check (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('retail.manage'))
    )
  );

drop policy if exists inventory_movements_select on inventory_movements;
create policy inventory_movements_select on inventory_movements for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('retail.manage'))
      or (select public.has_permission('reports.view'))
    )
  );
drop policy if exists inventory_movements_insert on inventory_movements;
create policy inventory_movements_insert on inventory_movements for insert
  with check (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('retail.manage'))
    )
  );

drop policy if exists inventory_purchases_select on inventory_purchases;
create policy inventory_purchases_select on inventory_purchases for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('reports.view'))
    )
  );
drop policy if exists inventory_purchases_write on inventory_purchases;
create policy inventory_purchases_write on inventory_purchases for all
  using (salon_id = (select public.salon_id()) and (select public.has_permission('inventory.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('inventory.manage')));

drop policy if exists inventory_purchase_items_select on inventory_purchase_items;
create policy inventory_purchase_items_select on inventory_purchase_items for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('reports.view'))
    )
  );
drop policy if exists inventory_purchase_items_write on inventory_purchase_items;
create policy inventory_purchase_items_write on inventory_purchase_items for all
  using (salon_id = (select public.salon_id()) and (select public.has_permission('inventory.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('inventory.manage')));

drop policy if exists retail_sales_select on retail_sales;
create policy retail_sales_select on retail_sales for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('retail.manage'))
      or (select public.has_permission('reports.view'))
    )
  );
drop policy if exists retail_sales_write on retail_sales;
create policy retail_sales_write on retail_sales for all
  using (salon_id = (select public.salon_id()) and (select public.has_permission('retail.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('retail.manage')));

drop policy if exists retail_sale_items_select on retail_sale_items;
create policy retail_sale_items_select on retail_sale_items for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('retail.manage'))
      or (select public.has_permission('reports.view'))
    )
  );
drop policy if exists retail_sale_items_write on retail_sale_items;
create policy retail_sale_items_write on retail_sale_items for all
  using (salon_id = (select public.salon_id()) and (select public.has_permission('retail.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('retail.manage')));

drop policy if exists expenses_select on expenses;
create policy expenses_select on expenses for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('expenses.manage'))
      or (select public.has_permission('reports.view'))
    )
  );
drop policy if exists expenses_write on expenses;
create policy expenses_write on expenses for all
  using (salon_id = (select public.salon_id()) and (select public.has_permission('expenses.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('expenses.manage')));
