-- Owner/staff feedback: report bugs, outages, suggestions. Read only by platform
-- admins (via service_role). Tenants can submit for their own salon but never read
-- others' reports — multi-tenant isolation is preserved.
create table feedback_reports (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references salons(id) on delete cascade,
  created_by  uuid references profiles(id) on delete set null,
  category    text not null default 'other',
  message     text not null check (length(message) between 1 and 2000),
  status      text not null default 'new',
  created_at  timestamptz not null default now()
);

create index idx_feedback_salon on feedback_reports (salon_id);
create index idx_feedback_status_created on feedback_reports (status, created_at desc);

alter table feedback_reports enable row level security;

-- Any authenticated member of a salon may submit feedback for THAT salon only.
-- created_by is pinned to the caller so it can't be spoofed.
create policy feedback_insert on feedback_reports for insert
  with check (salon_id = public.salon_id() and created_by = auth.uid());

-- No select/update/delete policies for tenants: platform admins read & triage
-- exclusively through the service_role client, which bypasses RLS.
