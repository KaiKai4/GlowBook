-- The tenant-aware composite foreign keys added in 20240101000020 are the
-- source of truth. Keeping the older single-column foreign keys makes PostgREST
-- see multiple relationship paths and breaks embedded selects used by
-- collaborators, services, appointments and reports.

alter table services
  drop constraint if exists services_category_id_fkey;

alter table employee_services
  drop constraint if exists employee_services_employee_id_fkey,
  drop constraint if exists employee_services_service_id_fkey;

alter table employee_categories
  drop constraint if exists employee_categories_employee_id_fkey,
  drop constraint if exists employee_categories_category_id_fkey;

alter table work_schedules
  drop constraint if exists work_schedules_employee_id_fkey;

alter table appointment_items
  drop constraint if exists appointment_items_service_id_fkey,
  drop constraint if exists appointment_items_employee_id_fkey;

alter table appointments
  drop constraint if exists appointments_customer_id_fkey;

notify pgrst, 'reload schema';
