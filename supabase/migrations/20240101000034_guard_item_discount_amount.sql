-- Guard against impossible service discounts.
-- A service-level discount cannot exceed the service price for that appointment item.

alter table appointment_items
  add constraint appointment_items_discount_not_greater_than_price
  check (discount_amount <= price);
