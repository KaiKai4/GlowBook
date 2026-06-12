-- Excepciones de horario por colaborador: dias libres puntuales (vacaciones,
-- permisos, feriados personales) que se suman al horario semanal recurrente.
-- V1: dia completo. La fecha es el dia calendario en la zona del salon.
-- El indice compuesto permite que la FK garantice que el colaborador pertenece
-- al mismo salon de la excepcion.
create unique index if not exists employees_salon_id_id_unique
  on employees (salon_id, id);

create table schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  employee_id uuid not null,
  exception_date date not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  constraint schedule_exceptions_employee_salon_fk
    foreign key (salon_id, employee_id)
    references employees (salon_id, id)
    on delete cascade,
  constraint schedule_exceptions_unique unique (employee_id, exception_date)
);

create index idx_schedule_exceptions_salon_emp
  on schedule_exceptions (salon_id, employee_id, exception_date);
create index idx_schedule_exceptions_salon_date
  on schedule_exceptions (salon_id, exception_date);

alter table schedule_exceptions enable row level security;

-- Mismo patron que work_schedules: lectura por salon, escritura con
-- employees.manage.
create policy sched_exc_select on schedule_exceptions for select
  using (salon_id = public.salon_id());
create policy sched_exc_write on schedule_exceptions for all
  using (salon_id = public.salon_id() and public.has_permission('employees.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('employees.manage'));
