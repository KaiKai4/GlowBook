-- Service-level discounts at appointment completion.
-- appointment_items.price keeps the service price before promotion.
-- appointment_items.discount_amount stores the promotion/discount for that service only.
-- appointments.discount_amount is the sum of item discounts for reporting.
-- appointments.total_price remains the final charged total.

alter table appointment_items
  add column if not exists discount_amount numeric(10,2) not null default 0
    check (discount_amount >= 0);

create or replace function recalc_appointment() returns trigger language plpgsql as $$
declare
  aid uuid := coalesce(new.appointment_id, old.appointment_id);
begin
  update appointments a
  set
    start_time      = sub.min_start,
    end_time        = sub.max_end,
    discount_amount = coalesce(sub.discount_total, 0),
    total_price     = greatest(coalesce(sub.total, 0) - coalesce(sub.discount_total, 0), 0),
    updated_at      = now()
  from (
    select
      min(start_time)              as min_start,
      max(end_time)                as max_end,
      sum(price)                   as total,
      sum(discount_amount)         as discount_total
    from appointment_items
    where appointment_id = aid
  ) sub
  where a.id = aid;
  return null;
end $$;
