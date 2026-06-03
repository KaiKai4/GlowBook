drop policy if exists inventory_purchases_select on inventory_purchases;
create policy inventory_purchases_select on inventory_purchases for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('reports.view'))
      or (select public.has_permission('expenses.manage'))
    )
  );

drop policy if exists inventory_purchase_items_select on inventory_purchase_items;
create policy inventory_purchase_items_select on inventory_purchase_items for select
  using (
    salon_id = (select public.salon_id())
    and (
      (select public.has_permission('inventory.manage'))
      or (select public.has_permission('reports.view'))
      or (select public.has_permission('expenses.manage'))
    )
  );
