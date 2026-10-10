-- Caracterizacion de privilegios de tabla de anon (migracion 20240101000080_anon_table_privileges.sql).
-- anon no tiene ningun privilegio de tabla, vista o secuencia en public (no extension), y las
-- politicas que usan salon_id aplican a authenticated, nunca a public ni a anon.
begin;
select plan(6);

-- (1) anon no tiene privilegios de tabla o vista en public (no extension)
select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (
        has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('anon', c.oid, 'REFERENCES')
        or has_table_privilege('anon', c.oid, 'TRIGGER')
      )
  ),
  0,
  'anon no tiene privilegios de tabla ni vista en public'
);

-- (2) anon no tiene privilegios sobre secuencias en public
select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and (
        has_sequence_privilege('anon', c.oid, 'USAGE')
        or has_sequence_privilege('anon', c.oid, 'SELECT')
        or has_sequence_privilege('anon', c.oid, 'UPDATE')
      )
  ),
  0,
  'anon no tiene privilegios sobre secuencias de public'
);

-- (3) los privilegios por defecto que crea el rol postgres (dueño de las migraciones) no conceden nada a anon
-- Los de supabase_admin son de la plataforma y no los gestiona este repositorio.
select is(
  (
    select count(*)::int
    from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) a
    where n.nspname = 'public'
      and d.defaclrole = 'postgres'::regrole
      and a.grantee = 'anon'::regrole
  ),
  0,
  'los privilegios por defecto de postgres en public no incluyen anon'
);

-- (4) toda politica de una tabla con columna salon_id, o cuyo USING / WITH CHECK mencione salon_id
-- (con o sin parentesis, p. ej. salon_id(), auth.jwt() ->> 'salon_id' o salon_id = ...), aplica a
-- authenticated y no a public ni a anon
select is(
  (
    select count(*)::int
    from pg_policies p
    where p.schemaname = 'public'
      and (
        exists (
          select 1
          from information_schema.columns col
          where col.table_schema = 'public'
            and col.table_name = p.tablename
            and col.column_name = 'salon_id'
        )
        or coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ~* '\msalon_id\M'
      )
      and (
        not ('authenticated' = any (p.roles))
        or 'public' = any (p.roles)
        or 'anon' = any (p.roles)
      )
  ),
  0,
  'toda politica de tabla con salon_id (columna o referencia) aplica a authenticated y no a public ni anon'
);

-- (5) la politica de permissions aplica a authenticated
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'permissions' and policyname = 'perm_read'
      and 'authenticated' = any (roles)
      and not ('public' = any (roles))
  ),
  'perm_read de permissions aplica a authenticated y no a public'
);

-- (6) comportamiento: anon no puede leer una tabla de negocio
set local role anon;
select throws_ok(
  $$ select count(*) from public.salons $$,
  '42501',
  null,
  'anon no puede leer salons (sin privilegio de tabla)'
);
reset role;

select * from finish();
rollback;
