-- 1. Las invitaciones llevan el plan que tendra el salon al aceptar,
--    asi el salon nace con su plan y nunca ve funcionalidades de mas.
alter table salon_invitations
  add column plan_id uuid references commercial_plans(id) on delete set null;

-- 2. Periodo pagado vigente de la suscripcion. Lo fija "Registrar pago":
--    marca que el salon pago y desde/hasta cuando corre su mes de uso.
alter table salon_plan_assignments
  add column current_period_start date,
  add column current_period_end date;

-- 3. Historial de pagos manuales registrados por la plataforma.
create table salon_plan_payments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  plan_id uuid references commercial_plans(id) on delete set null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'USD',
  paid_at date not null default current_date,
  period_start date not null,
  period_end date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint salon_plan_payments_period check (period_end > period_start)
);

create index idx_salon_plan_payments_salon on salon_plan_payments (salon_id, paid_at desc);

alter table salon_plan_payments enable row level security;

create policy salon_plan_payments_select on salon_plan_payments for select
  using (salon_id = (select public.salon_id()) or (select public.is_platform_admin()));
create policy salon_plan_payments_platform_write on salon_plan_payments for all
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));
