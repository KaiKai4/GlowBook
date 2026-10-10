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
  34,
  'authenticated tiene EXECUTE exactamente en 34 funciones de public (29 de la matriz de lectura y citas + confirm_appointment + 2 RPC de colaboradores + 2 RPC de roles)'
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
      'public.complete_appointment(jsonb)',
      'public.cancel_appointment(jsonb)',
      'public.mark_no_show(jsonb)',
      'public.invite_salon(text,uuid)',
      'public.record_retail_sale(uuid,uuid,uuid,text,numeric,numeric,text,text,uuid)',
      'public.record_inventory_transfer(uuid,uuid,text,text,numeric,text,uuid)',
      'public.record_inventory_purchase(uuid,text,date,uuid,numeric,numeric,text,uuid)',
      'public.report_monthly_history(uuid,timestamptz,timestamptz,text)',
      'public.report_day_start(date,text)',
      'public.report_day_end(date,text)',
      'public.report_completed_items(timestamptz,timestamptz)',
      'public.report_dashboard_metrics(text,timestamptz)',
      'public.report_dashboard_monthly_appointments(text,timestamptz)',
      'public.report_dashboard_top_services(text,timestamptz)',
      'public.report_period_totals(date,date,text,jsonb)',
      'public.report_operational_breakdown(date,date,text)',
      'public.report_commissions(date,date,text)',
      'public.report_monthly_series(text,text,text,jsonb,timestamptz)',
      'public.report_busy_hours(date,date,text)',
      'public.report_expense_concepts(date,date,jsonb,boolean,integer)',
      'public.report_product_sales(text,text,text,jsonb,integer)',
      'public.report_inventory_alerts(jsonb)',
      'public.report_expense_month_totals(uuid,date,date)',
      'public.create_employee_with_assignments(jsonb)',
      'public.update_employee_profile(jsonb)',
      'public.create_role_with_permissions(text,text[])',
      'public.replace_role_permissions(uuid,text[])'
    ]) as sig
  ),
  'authenticated puede ejecutar los helpers RLS y las RPC de cliente de usuario (incluidas las de cita)'
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
