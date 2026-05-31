-- Supabase performance advisors flagged two RLS patterns after the 5-salon smoke:
-- 1. auth.uid() calls evaluated per row in SELECT/INSERT policies.
-- 2. FOR ALL write policies overlapping explicit SELECT policies.
--
-- Keep the same tenant/permission contract, but let Postgres initplan stable
-- auth/permission checks once per statement where possible.

-- Auth initplan warnings.
drop policy if exists profile_select on profiles;
create policy profile_select on profiles for select
  using (id = (select auth.uid()) or salon_id = (select public.salon_id()));

drop policy if exists profile_write on profiles;
create policy profile_insert on profiles for insert
  with check (
    salon_id = (select public.salon_id())
    and (id = (select auth.uid()) or (select public.has_permission('employees.manage')))
  );
create policy profile_update on profiles for update
  using (
    salon_id = (select public.salon_id())
    and (id = (select auth.uid()) or (select public.has_permission('employees.manage')))
  )
  with check (
    salon_id = (select public.salon_id())
    and (id = (select auth.uid()) or (select public.has_permission('employees.manage')))
  );
create policy profile_delete on profiles for delete
  using (
    salon_id = (select public.salon_id())
    and (id = (select auth.uid()) or (select public.has_permission('employees.manage')))
  );

drop policy if exists perm_read on permissions;
create policy perm_read on permissions for select
  using ((select auth.uid()) is not null);

drop policy if exists appt_select on appointments;
create policy appt_select on appointments for select using (
  salon_id = (select public.salon_id())
  and ((select public.has_permission('appointments.view')) or (select public.has_permission('appointments.manage')))
  and (
    (select public.has_permission('appointments.view_all'))
    or exists (
      select 1
      from appointment_items ai
      join employees e on e.id = ai.employee_id
      where ai.appointment_id = appointments.id
        and e.profile_id = (select auth.uid())
    )
  )
);

drop policy if exists item_select on appointment_items;
create policy item_select on appointment_items for select using (
  salon_id = (select public.salon_id())
  and ((select public.has_permission('appointments.view')) or (select public.has_permission('appointments.manage')))
  and (
    (select public.has_permission('appointments.view_all'))
    or employee_id in (select id from employees where profile_id = (select auth.uid()))
  )
);

drop policy if exists feedback_insert on feedback_reports;
create policy feedback_insert on feedback_reports for insert
  with check (
    salon_id = (select public.salon_id())
    and created_by = (select auth.uid())
  );

-- Split FOR ALL write policies so SELECT remains controlled by the explicit
-- read policies.
drop policy if exists salon_write on salons;
create policy salon_insert on salons for insert
  with check (id = (select public.salon_id()) and (select public.has_permission('salon.manage')));
create policy salon_update on salons for update
  using (id = (select public.salon_id()) and (select public.has_permission('salon.manage')))
  with check (id = (select public.salon_id()) and (select public.has_permission('salon.manage')));
create policy salon_delete on salons for delete
  using (id = (select public.salon_id()) and (select public.has_permission('salon.manage')));

drop policy if exists sbh_write on salon_business_hours;
create policy sbh_insert on salon_business_hours for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('salon.manage')));
create policy sbh_update on salon_business_hours for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('salon.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('salon.manage')));
create policy sbh_delete on salon_business_hours for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('salon.manage')));

drop policy if exists roles_write on roles;
create policy roles_insert on roles for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('roles.manage')));
create policy roles_update on roles for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('roles.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('roles.manage')));
create policy roles_delete on roles for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('roles.manage')));

drop policy if exists rp_write on role_permissions;
create policy rp_insert on role_permissions for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('roles.manage')));
create policy rp_update on role_permissions for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('roles.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('roles.manage')));
create policy rp_delete on role_permissions for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('roles.manage')));

drop policy if exists cust_write on customers;
create policy cust_insert on customers for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('customers.manage')));
create policy cust_update on customers for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('customers.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('customers.manage')));
create policy cust_delete on customers for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('customers.manage')));

drop policy if exists scat_write on service_categories;
create policy scat_insert on service_categories for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('services.manage')));
create policy scat_update on service_categories for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('services.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('services.manage')));
create policy scat_delete on service_categories for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('services.manage')));

drop policy if exists svc_write on services;
create policy svc_insert on services for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('services.manage')));
create policy svc_update on services for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('services.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('services.manage')));
create policy svc_delete on services for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('services.manage')));

drop policy if exists emp_write on employees;
create policy emp_insert on employees for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));
create policy emp_update on employees for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));
create policy emp_delete on employees for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));

drop policy if exists emp_svc_write on employee_services;
create policy emp_svc_insert on employee_services for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));
create policy emp_svc_update on employee_services for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));
create policy emp_svc_delete on employee_services for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));

drop policy if exists emp_cat_write on employee_categories;
create policy emp_cat_insert on employee_categories for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));
create policy emp_cat_update on employee_categories for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));
create policy emp_cat_delete on employee_categories for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));

drop policy if exists ws_write on work_schedules;
create policy ws_insert on work_schedules for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));
create policy ws_update on work_schedules for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));
create policy ws_delete on work_schedules for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('employees.manage')));

drop policy if exists nt_write on notification_templates;
create policy nt_insert on notification_templates for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('reminders.send')));
create policy nt_update on notification_templates for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('reminders.send')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('reminders.send')));
create policy nt_delete on notification_templates for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('reminders.send')));

drop policy if exists arl_write on appointment_reminder_log;
create policy arl_insert on appointment_reminder_log for insert
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('reminders.send')));
create policy arl_update on appointment_reminder_log for update
  using (salon_id = (select public.salon_id()) and (select public.has_permission('reminders.send')))
  with check (salon_id = (select public.salon_id()) and (select public.has_permission('reminders.send')));
create policy arl_delete on appointment_reminder_log for delete
  using (salon_id = (select public.salon_id()) and (select public.has_permission('reminders.send')));

drop policy if exists inv_platform on salon_invitations;
create policy inv_platform_select on salon_invitations for select
  using ((select public.is_platform_admin()));
create policy inv_platform_insert on salon_invitations for insert
  with check ((select public.is_platform_admin()));
create policy inv_platform_update on salon_invitations for update
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));
create policy inv_platform_delete on salon_invitations for delete
  using ((select public.is_platform_admin()));
