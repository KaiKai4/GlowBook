create table platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_salon_id uuid,
  target_resource_type text,
  target_resource_id text,
  status text not null check (status in ('succeeded', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_platform_audit_actor_created on platform_audit_log (actor_user_id, created_at desc);
create index idx_platform_audit_action_created on platform_audit_log (action, created_at desc);
create index idx_platform_audit_target_salon_created on platform_audit_log (target_salon_id, created_at desc);

alter table platform_audit_log enable row level security;

create policy platform_audit_select on platform_audit_log for select
  using (public.is_platform_admin());
