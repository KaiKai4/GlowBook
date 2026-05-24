-- The appointment SELECT RLS policies scope rows to the caller's own appointments
-- via `employees.profile_id = auth.uid()`. employees is a global (multi-salon)
-- table, so without an index this becomes a sequential scan on every calendar
-- load for scoped collaborators. A partial index keeps that lookup fast (only a
-- minority of employees are linked to a login account).
create index if not exists idx_employees_profile
  on employees (profile_id)
  where profile_id is not null;
