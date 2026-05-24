-- Employee invitation tokens
-- Allows salon owners to generate a link so a collaborator can create their account.
-- The token lookup at acceptance time uses service_role (admin client) to bypass RLS.

create table employee_invitations (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid references employees(id) on delete cascade not null,
  salon_id     uuid references salons(id) on delete cascade not null,
  email        text not null,
  role_id      uuid references roles(id) on delete set null,
  token        text unique not null,
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  created_at   timestamptz default now()
);

alter table employee_invitations enable row level security;

-- Only users with employees.manage permission can insert or read invitations
create policy emp_inv_insert on employee_invitations
  for insert
  with check (salon_id = public.salon_id() and public.has_permission('employees.manage'));

create policy emp_inv_select on employee_invitations
  for select
  using (salon_id = public.salon_id() and public.has_permission('employees.manage'));

create policy emp_inv_update on employee_invitations
  for update
  using (salon_id = public.salon_id() and public.has_permission('employees.manage'));
