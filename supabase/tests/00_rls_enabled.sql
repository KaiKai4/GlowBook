-- Caracterizacion: toda tabla de public tiene RLS activa y al menos una policy
-- cuando lleva salon_id. Si aparece una tabla nueva sin RLS, esta prueba DEBE fallar.
begin;
select plan(2);

select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ),
  0,
  'toda tabla de public tiene row level security habilitada'
);

select is(
  (
    select count(*)::int
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'salon_id'
      and not a.attisdropped
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
      )
  ),
  0,
  'toda tabla con salon_id tiene al menos una policy RLS'
);

select * from finish();
rollback;
