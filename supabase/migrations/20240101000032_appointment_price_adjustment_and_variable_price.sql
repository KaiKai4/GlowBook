-- Hybrid variable pricing at appointment completion.
-- This migration introduced appointment-level discount fields as the first pass.
-- Migration 20240101000033 moves discount calculation to appointment_items so
-- service-specific promotions do not discount unrelated services.

alter table appointments
  add column if not exists discount_amount numeric(10,2) not null default 0
    check (discount_amount >= 0);

alter table appointments
  add column if not exists completion_price_note text not null default '';

alter table service_categories
  add column if not exists pricing_mode text not null default 'fixed'
    check (pricing_mode in ('fixed', 'variable'));

create or replace function recalc_appointment() returns trigger language plpgsql as $$
declare
  aid uuid := coalesce(new.appointment_id, old.appointment_id);
begin
  update appointments a
  set
    start_time  = sub.min_start,
    end_time    = sub.max_end,
    total_price = greatest(coalesce(sub.total, 0) - coalesce(a.discount_amount, 0), 0),
    updated_at  = now()
  from (
    select
      min(start_time) as min_start,
      max(end_time)   as max_end,
      sum(price)      as total
    from appointment_items
    where appointment_id = aid
  ) sub
  where a.id = aid;
  return null;
end $$;
