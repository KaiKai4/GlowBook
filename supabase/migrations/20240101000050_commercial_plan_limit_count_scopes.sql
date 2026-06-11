alter table commercial_limit_metrics
  add column if not exists default_count_scope text not null default 'current'
    check (default_count_scope in ('current', 'monthly', 'billing_cycle', 'lifetime'));

alter table commercial_plan_limits
  add column if not exists count_scope text not null default 'current'
    check (count_scope in ('current', 'monthly', 'billing_cycle', 'lifetime'));

update commercial_limit_metrics
set default_count_scope = case key
  when 'appointments.total' then 'billing_cycle'
  when 'retail.sales' then 'billing_cycle'
  when 'inventory.movements' then 'billing_cycle'
  when 'expenses.total' then 'billing_cycle'
  else 'current'
end;

update commercial_plan_limits plan_limit
set count_scope = metric.default_count_scope
from commercial_limit_metrics metric
where metric.key = plan_limit.metric_key
  and plan_limit.count_scope = 'current';
