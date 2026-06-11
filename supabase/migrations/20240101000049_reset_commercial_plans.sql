drop table if exists billing_usage_events cascade;
drop table if exists billing_salon_entitlement_overrides cascade;
drop table if exists billing_salon_usage_snapshots cascade;
drop table if exists billing_salon_addons cascade;
drop table if exists billing_salon_subscriptions cascade;
drop table if exists billing_plan_entitlements cascade;
drop table if exists billing_plans cascade;
drop table if exists billing_features cascade;

create table platform_modules (
  key text primary key,
  name text not null,
  description text not null default '',
  nav_href text not null default '',
  icon_name text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_platform_modules_updated_at before update on platform_modules
  for each row execute function set_updated_at();

create table commercial_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  currency text not null default 'USD',
  monthly_price numeric(10,2) not null default 0 check (monthly_price >= 0),
  trial_days integer not null default 0 check (trial_days >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_commercial_plans_updated_at before update on commercial_plans
  for each row execute function set_updated_at();

create table commercial_plan_modules (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references commercial_plans(id) on delete cascade,
  module_key text not null references platform_modules(key) on delete restrict,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, module_key)
);

create trigger trg_commercial_plan_modules_updated_at before update on commercial_plan_modules
  for each row execute function set_updated_at();

create table commercial_limit_metrics (
  key text primary key,
  module_key text not null references platform_modules(key) on delete restrict,
  name text not null,
  description text not null default '',
  unit text not null default '',
  counter_key text not null,
  default_count_scope text not null default 'current'
    check (default_count_scope in ('current', 'monthly', 'billing_cycle', 'lifetime')),
  is_active boolean not null default true,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_commercial_limit_metrics_updated_at before update on commercial_limit_metrics
  for each row execute function set_updated_at();

create table commercial_plan_limits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references commercial_plans(id) on delete cascade,
  metric_key text not null references commercial_limit_metrics(key) on delete restrict,
  max_value integer check (max_value is null or max_value >= 0),
  enforcement_mode text not null default 'warn'
    check (enforcement_mode in ('none', 'warn', 'block')),
  warning_threshold integer not null default 80 check (warning_threshold >= 1 and warning_threshold <= 100),
  count_scope text not null default 'current'
    check (count_scope in ('current', 'monthly', 'billing_cycle', 'lifetime')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, metric_key)
);

create trigger trg_commercial_plan_limits_updated_at before update on commercial_plan_limits
  for each row execute function set_updated_at();

create table salon_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null unique references salons(id) on delete cascade,
  plan_id uuid not null references commercial_plans(id) on delete restrict,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled')),
  starts_at date,
  ends_at date,
  trial_ends_at date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_salon_plan_assignments_updated_at before update on salon_plan_assignments
  for each row execute function set_updated_at();

create table salon_plan_overrides (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  module_key text references platform_modules(key) on delete restrict,
  metric_key text references commercial_limit_metrics(key) on delete restrict,
  module_enabled boolean,
  max_delta integer check (max_delta is null or max_delta >= 0),
  max_override integer check (max_override is null or max_override >= 0),
  enforcement_mode text check (enforcement_mode is null or enforcement_mode in ('none', 'warn', 'block')),
  warning_threshold integer check (warning_threshold is null or (warning_threshold >= 1 and warning_threshold <= 100)),
  reason text not null default '',
  starts_at date,
  ends_at date,
  status text not null default 'active'
    check (status in ('active', 'paused', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_plan_overrides_target_required
    check (module_key is not null or metric_key is not null)
);

create trigger trg_salon_plan_overrides_updated_at before update on salon_plan_overrides
  for each row execute function set_updated_at();

create table salon_plan_alerts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  plan_id uuid references commercial_plans(id) on delete set null,
  metric_key text references commercial_limit_metrics(key) on delete set null,
  module_key text references platform_modules(key) on delete set null,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'danger')),
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now()
);

create index idx_platform_modules_order on platform_modules (sort_order, name) where not is_archived;
create index idx_commercial_limit_metrics_module on commercial_limit_metrics (module_key, sort_order, name) where not is_archived;
create index idx_commercial_plan_limits_plan on commercial_plan_limits (plan_id);
create index idx_salon_plan_overrides_active on salon_plan_overrides (salon_id, status);
create index idx_salon_plan_alerts_open on salon_plan_alerts (status, created_at desc);

alter table platform_modules enable row level security;
alter table commercial_plans enable row level security;
alter table commercial_plan_modules enable row level security;
alter table commercial_limit_metrics enable row level security;
alter table commercial_plan_limits enable row level security;
alter table salon_plan_assignments enable row level security;
alter table salon_plan_overrides enable row level security;
alter table salon_plan_alerts enable row level security;

create policy platform_modules_select on platform_modules for select
  using (not is_archived or (select public.is_platform_admin()));
create policy platform_modules_platform_write on platform_modules for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

create policy commercial_plans_select on commercial_plans for select
  using (status <> 'archived' or (select public.is_platform_admin()));
create policy commercial_plans_platform_write on commercial_plans for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

create policy commercial_plan_modules_select on commercial_plan_modules for select
  using ((select public.is_platform_admin()) or true);
create policy commercial_plan_modules_platform_write on commercial_plan_modules for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

create policy commercial_limit_metrics_select on commercial_limit_metrics for select
  using (not is_archived or (select public.is_platform_admin()));
create policy commercial_limit_metrics_platform_write on commercial_limit_metrics for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

create policy commercial_plan_limits_select on commercial_plan_limits for select
  using ((select public.is_platform_admin()) or true);
create policy commercial_plan_limits_platform_write on commercial_plan_limits for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

create policy salon_plan_assignments_select on salon_plan_assignments for select
  using (salon_id = (select public.salon_id()) or (select public.is_platform_admin()));
create policy salon_plan_assignments_platform_write on salon_plan_assignments for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

create policy salon_plan_overrides_select on salon_plan_overrides for select
  using (salon_id = (select public.salon_id()) or (select public.is_platform_admin()));
create policy salon_plan_overrides_platform_write on salon_plan_overrides for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

create policy salon_plan_alerts_select on salon_plan_alerts for select
  using (salon_id = (select public.salon_id()) or (select public.is_platform_admin()));
create policy salon_plan_alerts_platform_write on salon_plan_alerts for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

insert into platform_modules (key, name, description, nav_href, icon_name, sort_order) values
  ('appointments', 'Citas', 'Agenda, calendario y creacion de citas.', '/appointments', 'CalendarDays', 10),
  ('recordatorios', 'Recordatorios', 'Recordatorios operativos de citas.', '/recordatorios', 'Bell', 20),
  ('customers', 'Clientes', 'Registro y gestion de clientes.', '/customers', 'Users', 30),
  ('employees', 'Colaboradores', 'Equipo, horarios y accesos.', '/employees', 'UserCog', 40),
  ('services', 'Servicios', 'Catalogo de servicios y categorias.', '/services', 'Scissors', 50),
  ('retail', 'Vitrina', 'Ventas de productos del salon.', '/retail', 'ShoppingBag', 60),
  ('inventory', 'Inventario', 'Productos, stock, movimientos y reposiciones.', '/inventory', 'Package', 70),
  ('reports', 'Reportes', 'Metricas e informes operativos.', '/reports', 'BarChart3', 80),
  ('expenses', 'Gastos', 'Registro de egresos operativos.', '/expenses', 'ReceiptText', 90),
  ('roles', 'Roles', 'Roles y permisos internos.', '/roles', 'Shield', 100),
  ('plantillas', 'Plantillas', 'Plantillas de mensajes.', '/plantillas', 'MessageSquareText', 110),
  ('salon', 'Salon', 'Configuracion del negocio.', '/salon', 'Settings', 120)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  nav_href = excluded.nav_href,
  icon_name = excluded.icon_name,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into commercial_limit_metrics (key, module_key, name, description, unit, counter_key, default_count_scope, sort_order) values
  ('appointments.total', 'appointments', 'Citas registradas', 'Citas creadas dentro del ciclo de facturacion.', 'citas', 'appointments_total', 'billing_cycle', 10),
  ('customers.active', 'customers', 'Clientes activos', 'Total maximo de clientes activos.', 'clientes', 'customers_active', 'current', 10),
  ('employees.active', 'employees', 'Colaboradores activos', 'Total maximo de colaboradores activos.', 'colaboradores', 'employees_active', 'current', 10),
  ('employees.login_users', 'employees', 'Usuarios con acceso', 'Total maximo de colaboradores con acceso propio.', 'usuarios', 'login_users_total', 'current', 20),
  ('services.active', 'services', 'Servicios activos', 'Total maximo de servicios activos.', 'servicios', 'services_active', 'current', 10),
  ('retail.sales', 'retail', 'Ventas de vitrina', 'Ventas registradas dentro del ciclo de facturacion.', 'ventas', 'retail_sales_total', 'billing_cycle', 10),
  ('inventory.products', 'inventory', 'Productos de inventario', 'Total maximo de productos activos en inventario.', 'productos', 'inventory_products_active', 'current', 10),
  ('inventory.movements', 'inventory', 'Movimientos de inventario', 'Movimientos registrados dentro del ciclo de facturacion.', 'movimientos', 'inventory_movements_total', 'billing_cycle', 20),
  ('expenses.total', 'expenses', 'Gastos registrados', 'Gastos registrados dentro del ciclo de facturacion.', 'gastos', 'expenses_total', 'billing_cycle', 10)
on conflict (key) do update set
  module_key = excluded.module_key,
  name = excluded.name,
  description = excluded.description,
  unit = excluded.unit,
  counter_key = excluded.counter_key,
  default_count_scope = excluded.default_count_scope,
  sort_order = excluded.sort_order,
  updated_at = now();
