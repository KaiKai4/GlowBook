-- ─── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists btree_gist;

-- ─── Helper: salon_id from JWT claim ───────────────────────────────────────
-- Lives in `public` (hosted Supabase forbids creating objects in the auth schema).
-- Re-defined with a table fallback in migration 001 once `profiles` exists.
create or replace function public.salon_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'salon_id', '')::uuid
$$;

-- ─── updated_at trigger function ───────────────────────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── Tenant root ────────────────────────────────────────────────────────────
create table salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  timezone text not null default 'America/Panama',
  primary_color text not null default '',
  secondary_color text not null default '',
  min_booking_notice_minutes int not null default 60
    check (min_booking_notice_minutes between 0 and 10080),
  min_appointment_duration_minutes int not null default 30
    check (min_appointment_duration_minutes between 15 and 480),
  allow_off_hours_bookings boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_salons_updated_at before update on salons
  for each row execute function set_updated_at();

-- ─── RBAC: global permission catalog ───────────────────────────────────────
create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null default ''
);

-- ─── RBAC: roles per salon ──────────────────────────────────────────────────
create table roles (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, name)
);
create index idx_roles_salon on roles (salon_id);
create trigger trg_roles_updated_at before update on roles
  for each row execute function set_updated_at();

-- ─── RBAC: role ↔ permission M2M ────────────────────────────────────────────
create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  salon_id uuid not null references salons(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- ─── Profile: links auth.users → salon + assigned role ─────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  salon_id uuid not null references salons(id) on delete restrict,
  role_id uuid references roles(id) on delete restrict,
  is_owner boolean not null default false,
  full_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_salon_role on profiles (salon_id, role_id);
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ─── Salon business hours ───────────────────────────────────────────────────
create table salon_business_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  open_time time,
  close_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, day_of_week),
  check (not is_open or (open_time is not null and close_time is not null and close_time > open_time))
);
create trigger trg_sbh_updated_at before update on salon_business_hours
  for each row execute function set_updated_at();

-- ─── Customers ──────────────────────────────────────────────────────────────
create table customers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  birth_date date,
  notes text not null default '',
  is_active boolean not null default true,
  is_temporary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_customer_phone_per_salon on customers (salon_id, phone) where phone is not null;
create unique index uq_customer_email_per_salon on customers (salon_id, email) where email is not null;
create index idx_customers_salon_active on customers (salon_id, is_active);
create index idx_customers_salon_temp on customers (salon_id, is_temporary);
create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();

-- ─── Service categories and services ───────────────────────────────────────
create table service_categories (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  ordering int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, name)
);
create trigger trg_scat_updated_at before update on service_categories
  for each row execute function set_updated_at();

create table services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  category_id uuid not null references service_categories(id) on delete restrict,
  name text not null,
  description text not null default '',
  duration_minutes int not null check (duration_minutes >= 1),
  price numeric(10,2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, name)
);
create index idx_services_salon_active on services (salon_id, is_active);
create index idx_services_salon_cat on services (salon_id, category_id);
create trigger trg_services_updated_at before update on services
  for each row execute function set_updated_at();

-- ─── Employees ──────────────────────────────────────────────────────────────
create table employees (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  phone text not null default '',
  email text not null default '',
  specialty text not null default '',
  commission_percentage numeric(5,2) not null default 0
    check (commission_percentage between 0 and 100),
  hire_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_employees_salon_active on employees (salon_id, is_active);
create trigger trg_employees_updated_at before update on employees
  for each row execute function set_updated_at();

create table employee_services (
  employee_id uuid not null references employees(id) on delete cascade,
  service_id  uuid not null references services(id)  on delete cascade,
  salon_id uuid not null references salons(id) on delete cascade,
  primary key (employee_id, service_id)
);

create table employee_categories (
  employee_id uuid not null references employees(id) on delete cascade,
  category_id uuid not null references service_categories(id) on delete cascade,
  salon_id uuid not null references salons(id) on delete cascade,
  primary key (employee_id, category_id)
);

-- ─── Work schedules ─────────────────────────────────────────────────────────
create table work_schedules (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, employee_id, day_of_week, start_time, end_time)
);
create trigger trg_ws_updated_at before update on work_schedules
  for each row execute function set_updated_at();

-- ─── Appointments (header; derived fields maintained by trigger) ────────────
create table appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete restrict,
  status text not null default 'scheduled'
    check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  payment_method text not null default ''
    check (payment_method in ('','cash','card','transfer','yappy','other')),
  notes text not null default '',
  start_time timestamptz,
  end_time   timestamptz,
  total_price numeric(10,2) not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_appt_salon_start on appointments (salon_id, start_time);
create index idx_appt_salon_status on appointments (salon_id, status);
create index idx_appt_salon_customer on appointments (salon_id, customer_id, start_time);
create trigger trg_appt_updated_at before update on appointments
  for each row execute function set_updated_at();

-- ─── Appointment items: THE TRUTH ───────────────────────────────────────────
create table appointment_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  service_id uuid not null references services(id) on delete restrict,
  employee_id uuid not null references employees(id) on delete restrict,
  start_time timestamptz not null,
  end_time   timestamptz not null check (end_time > start_time),
  duration_minutes int not null check (duration_minutes >= 1),
  price numeric(10,2) not null default 0,
  ordering int not null default 0,
  blocks_calendar boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, ordering)
);
create index idx_items_salon_emp_start on appointment_items (salon_id, employee_id, start_time);
create index idx_items_salon_appt on appointment_items (salon_id, appointment_id, ordering);
create trigger trg_items_updated_at before update on appointment_items
  for each row execute function set_updated_at();

-- Anti double-booking exclusion constraint (§3.2)
alter table appointment_items
  add constraint no_overlap_per_employee
  exclude using gist (
    employee_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (blocks_calendar);

-- ─── Notification templates ─────────────────────────────────────────────────
create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  event text not null check (event in (
    'appointment_assigned','appointment_confirmed',
    'appointment_cancelled','appointment_reminder'
  )),
  recipient text not null default 'customer'
    check (recipient in ('employee','customer','both')),
  name text not null,
  subject text not null default '',
  body_text text not null,
  body_html text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, channel, event, name)
);
create trigger trg_nt_updated_at before update on notification_templates
  for each row execute function set_updated_at();

-- ─── Appointment reminder audit log ─────────────────────────────────────────
create table appointment_reminder_log (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  template_id uuid references notification_templates(id) on delete set null,
  channel text not null,
  recipient_phone text,
  recipient_email text,
  sent_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);

-- ─── Platform tier ──────────────────────────────────────────────────────────
create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table salon_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  status text not null default 'pending'
    check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id),
  salon_id uuid references salons(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_inv_email on salon_invitations (lower(email));
create index idx_inv_status on salon_invitations (status);
