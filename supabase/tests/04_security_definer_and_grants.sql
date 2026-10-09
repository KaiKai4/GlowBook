-- Caracterizacion de seguridad de funciones en public (estado tras la Fase 2).
-- Matriz de EXECUTE (ver migracion 20240101000064_security_hardening.sql):
--   * anon: ninguna funcion de public (no extension).
--   * authenticated: solo helpers de RLS y RPC de cliente de usuario.
--   * service_role: solo RPC de cliente admin y consume_rate_limit.
--   * supabase_auth_admin: solo el Auth Hook.
--   * triggers: ningun rol cliente (se disparan sin comprobar EXECUTE).
-- Las funciones de extensiones instaladas en public (gbt_*, *_dist) se excluyen del recuento.
begin;
select plan(12);

-- (e) search_path fijado en todas las SECURITY DEFINER de public
select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        where cfg like 'search_path=%'
      )
  ),
  0,
  'toda funcion SECURITY DEFINER de public fija search_path'
);

-- (e2) search_path fijado en TODAS las funciones de public (no extension)
select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        where cfg like 'search_path=%'
      )
  ),
  0,
  'toda funcion de public (no extension) fija search_path'
);

-- (f1) anon no ejecuta ninguna funcion de public (no extension)
select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0,
  'anon no tiene EXECUTE en ninguna funcion de public'
);

-- (f2) authenticated ejecuta exactamente la lista permitida (helpers RLS + RPC de usuario)
select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  11,
  'authenticated tiene EXECUTE exactamente en 11 funciones de public'
);

select ok(
  (
    select bool_and(has_function_privilege('authenticated', sig, 'EXECUTE'))
    from unnest(array[
      'public.salon_id()',
      'public.is_owner()',
      'public.has_permission(text)',
      'public.is_platform_admin()',
      'public.create_appointment(jsonb)',
      'public.update_appointment(jsonb)',
      'public.invite_salon(text)',
      'public.record_retail_sale(uuid,uuid,uuid,text,numeric,numeric,text,text)',
      'public.record_inventory_transfer(uuid,uuid,text,text,numeric,text)',
      'public.record_inventory_purchase(uuid,text,date,uuid,numeric,numeric,text)',
      'public.report_monthly_history(uuid,timestamptz,timestamptz,text)'
    ]) as sig
  ),
  'authenticated puede ejecutar los helpers RLS y las RPC de cliente de usuario'
);

-- (f3) service_role ejecuta exactamente la lista admin (+ consume_rate_limit)
select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  5,
  'service_role tiene EXECUTE exactamente en 5 funciones de public'
);

select ok(
  (
    select bool_and(has_function_privilege('service_role', sig, 'EXECUTE'))
    from unnest(array[
      'public.delete_salon_completely(uuid)',
      'public.platform_salon_overviews()',
      'public.accept_invitation_admin(text,uuid,text,text,text)',
      'public.count_salon_usage(uuid,jsonb)',
      'public.consume_rate_limit(text,integer,integer)'
    ]) as sig
  ),
  'service_role puede ejecutar las RPC de cliente admin y consume_rate_limit'
);

-- Triggers: ningun rol cliente ni service_role tiene EXECUTE
select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
  ),
  0,
  'ninguna funcion trigger de public es ejecutable por roles cliente'
);

-- Auth Hook: solo supabase_auth_admin
select ok(
  has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.custom_access_token_hook(jsonb)', 'EXECUTE'),
  'el Auth Hook solo es ejecutable por supabase_auth_admin'
);

-- Politicas que aplican al rol public (incluye anon) no dependen de helpers SQL
select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and 'public' = any(roles)
      and coalesce(qual, '') || ' ' || coalesce(with_check, '')
          ~ '\m(salon_id|has_permission|is_owner|is_platform_admin)\s*\('
  ),
  0,
  'ninguna politica aplicable a public (anon) invoca helpers que anon no puede ejecutar'
);

-- Guardas: RPC de plataforma y de borrado NO ejecutables por roles de salon o anon
select ok(
  not has_function_privilege('authenticated', 'public.platform_salon_overviews()', 'EXECUTE'),
  'authenticated no puede ejecutar platform_salon_overviews'
);

select ok(
  not has_function_privilege('anon', 'public.delete_salon_completely(uuid)', 'EXECUTE'),
  'anon no puede ejecutar delete_salon_completely'
);

select * from finish();
rollback;
