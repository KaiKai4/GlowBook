-- Catalogo de extras vendibles (modulos sueltos o bloques de limite)
-- y soporte de extras por salon: cantidad, regalo y precio especial.

create table commercial_addons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  kind text not null check (kind in ('module', 'limit_boost')),
  module_key text references platform_modules(key) on delete restrict,
  metric_key text references commercial_limit_metrics(key) on delete restrict,
  limit_delta integer check (limit_delta is null or limit_delta >= 1),
  currency text not null default 'USD',
  monthly_price numeric(10,2) not null default 0 check (monthly_price >= 0),
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_addons_target check (
    (kind = 'module' and module_key is not null)
    or (kind = 'limit_boost' and metric_key is not null and limit_delta is not null)
  )
);

create trigger trg_commercial_addons_updated_at before update on commercial_addons
  for each row execute function set_updated_at();

create index idx_commercial_addons_order on commercial_addons (sort_order, name)
  where status <> 'archived';

alter table commercial_addons enable row level security;

create policy commercial_addons_select on commercial_addons for select
  using (status <> 'archived' or (select public.is_platform_admin()));
create policy commercial_addons_platform_write on commercial_addons for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

-- Un extra asignado a un salon puede venir del catalogo (addon_id),
-- repetirse (quantity), regalarse (is_gift) o tener precio especial.
alter table salon_plan_overrides
  add column addon_id uuid references commercial_addons(id) on delete set null,
  add column quantity integer not null default 1 check (quantity >= 1),
  add column is_gift boolean not null default false,
  add column price_override numeric(10,2) check (price_override is null or price_override >= 0);

-- Catalogo inicial sugerido por la estrategia comercial. Editable desde Superadmin.
insert into commercial_addons (code, name, description, kind, module_key, metric_key, limit_delta, monthly_price, sort_order) values
  ('extra-login-user', 'Usuario con acceso adicional', 'Un colaborador mas con login propio.', 'limit_boost', null, 'employees.login_users', 1, 5.00, 10),
  ('extra-appointments-1000', 'Bloque de 1,000 citas', 'Aumenta el limite mensual de citas en 1,000.', 'limit_boost', null, 'appointments.total', 1000, 8.00, 20),
  ('addon-retail', 'Vitrina', 'Activa ventas de productos del salon.', 'module', 'retail', null, null, 10.00, 30),
  ('addon-expenses', 'Gastos', 'Activa el registro de egresos operativos.', 'module', 'expenses', null, null, 9.00, 40),
  ('addon-inventory', 'Inventario', 'Activa productos, stock y reposiciones.', 'module', 'inventory', null, null, 18.00, 50),
  ('addon-reports', 'Reportes avanzados', 'Activa metricas e informes operativos.', 'module', 'reports', null, null, 10.00, 60)
on conflict (code) do nothing;
