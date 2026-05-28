-- Enforce tenant-aware integrity across category -> service -> collaborator
-- relationships. The app validates these paths, but the database must also
-- reject cross-salon links if a bug or direct SQL call sends inconsistent IDs.

do $$
begin
  if exists (
    select 1
    from services s
    join service_categories c on c.id = s.category_id
    where c.salon_id <> s.salon_id
  ) then
    raise exception 'Cannot add service/category tenant constraints: mismatched services exist';
  end if;

  if exists (
    select 1
    from employee_services es
    left join employees e on e.id = es.employee_id
    left join services s on s.id = es.service_id
    where e.id is null
       or s.id is null
       or e.salon_id <> es.salon_id
       or s.salon_id <> es.salon_id
  ) then
    raise exception 'Cannot add employee/service tenant constraints: mismatched assignments exist';
  end if;

  if exists (
    select 1
    from employee_categories ec
    left join employees e on e.id = ec.employee_id
    left join service_categories c on c.id = ec.category_id
    where e.id is null
       or c.id is null
       or e.salon_id <> ec.salon_id
       or c.salon_id <> ec.salon_id
  ) then
    raise exception 'Cannot add employee/category tenant constraints: mismatched assignments exist';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'uq_service_categories_id_salon') then
    alter table service_categories
      add constraint uq_service_categories_id_salon unique (id, salon_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'uq_services_id_salon') then
    alter table services
      add constraint uq_services_id_salon unique (id, salon_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'uq_employees_id_salon') then
    alter table employees
      add constraint uq_employees_id_salon unique (id, salon_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'uq_customers_id_salon') then
    alter table customers
      add constraint uq_customers_id_salon unique (id, salon_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_services_category_same_salon') then
    alter table services
      add constraint fk_services_category_same_salon
      foreign key (category_id, salon_id)
      references service_categories (id, salon_id)
      on delete restrict
      not valid;
    alter table services validate constraint fk_services_category_same_salon;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_employee_services_employee_same_salon') then
    alter table employee_services
      add constraint fk_employee_services_employee_same_salon
      foreign key (employee_id, salon_id)
      references employees (id, salon_id)
      on delete cascade
      not valid;
    alter table employee_services validate constraint fk_employee_services_employee_same_salon;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_employee_services_service_same_salon') then
    alter table employee_services
      add constraint fk_employee_services_service_same_salon
      foreign key (service_id, salon_id)
      references services (id, salon_id)
      on delete cascade
      not valid;
    alter table employee_services validate constraint fk_employee_services_service_same_salon;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_employee_categories_employee_same_salon') then
    alter table employee_categories
      add constraint fk_employee_categories_employee_same_salon
      foreign key (employee_id, salon_id)
      references employees (id, salon_id)
      on delete cascade
      not valid;
    alter table employee_categories validate constraint fk_employee_categories_employee_same_salon;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_employee_categories_category_same_salon') then
    alter table employee_categories
      add constraint fk_employee_categories_category_same_salon
      foreign key (category_id, salon_id)
      references service_categories (id, salon_id)
      on delete cascade
      not valid;
    alter table employee_categories validate constraint fk_employee_categories_category_same_salon;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_work_schedules_employee_same_salon') then
    alter table work_schedules
      add constraint fk_work_schedules_employee_same_salon
      foreign key (employee_id, salon_id)
      references employees (id, salon_id)
      on delete cascade
      not valid;
    alter table work_schedules validate constraint fk_work_schedules_employee_same_salon;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_appointment_items_service_same_salon') then
    alter table appointment_items
      add constraint fk_appointment_items_service_same_salon
      foreign key (service_id, salon_id)
      references services (id, salon_id)
      on delete restrict
      not valid;
    alter table appointment_items validate constraint fk_appointment_items_service_same_salon;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_appointment_items_employee_same_salon') then
    alter table appointment_items
      add constraint fk_appointment_items_employee_same_salon
      foreign key (employee_id, salon_id)
      references employees (id, salon_id)
      on delete restrict
      not valid;
    alter table appointment_items validate constraint fk_appointment_items_employee_same_salon;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_appointments_customer_same_salon') then
    alter table appointments
      add constraint fk_appointments_customer_same_salon
      foreign key (customer_id, salon_id)
      references customers (id, salon_id)
      on delete restrict
      not valid;
    alter table appointments validate constraint fk_appointments_customer_same_salon;
  end if;
end $$;
