drop policy if exists inventory_purchases_select on public.inventory_purchases;
create policy inventory_purchases_select
  on public.inventory_purchases
  for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('expenses.manage'))
      or (select public.has_permission('reports.view'))
    )
  );

drop policy if exists inventory_purchase_items_select on public.inventory_purchase_items;
create policy inventory_purchase_items_select
  on public.inventory_purchase_items
  for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('expenses.manage'))
      or (select public.has_permission('reports.view'))
    )
  );
