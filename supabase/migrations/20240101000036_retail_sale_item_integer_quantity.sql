alter table public.retail_sale_items
  drop constraint if exists retail_sale_items_quantity_integer;

alter table public.retail_sale_items
  add constraint retail_sale_items_quantity_integer
  check (quantity = trunc(quantity));
