-- Fix: appt_write and item_write were declared FOR ALL, which also creates a
-- permissive SELECT policy. This caused any user with appointments.manage to
-- bypass the employee-scoping in appt_select and see ALL appointments in the
-- salon, ignoring the view_all permission check.
-- Solution: split each FOR ALL policy into explicit INSERT / UPDATE / DELETE
-- policies so that SELECT is handled exclusively by the scoped SELECT policies.

-- ── appointments ─────────────────────────────────────────────────────────────

drop policy if exists appt_write on appointments;

create policy appt_insert on appointments
  for insert
  with check (salon_id = public.salon_id() and public.has_permission('appointments.manage'));

create policy appt_update on appointments
  for update
  using (salon_id = public.salon_id() and public.has_permission('appointments.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('appointments.manage'));

create policy appt_delete on appointments
  for delete
  using (salon_id = public.salon_id() and public.has_permission('appointments.manage'));

-- ── appointment_items ─────────────────────────────────────────────────────────

drop policy if exists item_write on appointment_items;

create policy item_insert on appointment_items
  for insert
  with check (salon_id = public.salon_id() and public.has_permission('appointments.manage'));

create policy item_update on appointment_items
  for update
  using (salon_id = public.salon_id() and public.has_permission('appointments.manage'))
  with check (salon_id = public.salon_id() and public.has_permission('appointments.manage'));

create policy item_delete on appointment_items
  for delete
  using (salon_id = public.salon_id() and public.has_permission('appointments.manage'));
