-- Cobertura del catalogo de borrado (F03-1).
-- Toda tabla de public con columna salon_id debe aparecer en el cuerpo de delete_salon_completely
-- como "delete from <tabla>". Asi una tabla nueva con salon_id sin tratar rompe esta prueba
-- y no deja datos huerfanos ni bloqueos por FK restrict en el borrado de salons.
begin;
select plan(2);

-- 1: tablas con salon_id que la RPC no borra explicitamente (debe devolver NULL).
select is(
  (
    select string_agg(c.relname::text, ', ' order by c.relname)
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relkind = 'r'
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'salon_id' and not a.attisdropped
      )
      and not exists (
        select 1 from pg_proc p
        where p.oid = 'public.delete_salon_completely(uuid)'::regprocedure
          and pg_get_functiondef(p.oid) ~ ('delete from (public\.)?' || c.relname || '\M')
      )
  ),
  null::text,
  'toda tabla con salon_id tiene un "delete from" explicito en delete_salon_completely'
);

-- 2: la RPC borra el propio salon al final (las demas tablas dependen de ese orden).
select ok(
  pg_get_functiondef('public.delete_salon_completely(uuid)'::regprocedure) ~ 'delete from salons where id = p_salon_id',
  'delete_salon_completely borra la fila de salons'
);

select * from finish();
rollback;
