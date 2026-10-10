-- find_auth_user_id_by_email: busqueda de usuario de Auth por email normalizado (lower/trim).
-- Es security definer con search_path fijo y EXECUTE solo para service_role. Authenticated y anon
-- no pueden ejecutarla: no deben poder enumerar cuentas de Auth.
begin;
select plan(8);

-- Fixtures (como postgres)
insert into auth.users (id, email, aud, role) values
  ('d0000000-0000-0000-0000-00000000000a', 'Owner.Auth@GlowBook.test', 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000b', 'otro.auth@glowbook.test', 'authenticated', 'authenticated');

-- Encuentra por email exacto
select is(
  public.find_auth_user_id_by_email('owner.auth@glowbook.test'),
  'd0000000-0000-0000-0000-00000000000a'::uuid,
  'encuentra el usuario por email exacto'
);

-- Normaliza mayusculas y espacios en el parametro y en el dato guardado
select is(
  public.find_auth_user_id_by_email('  OWNER.AUTH@glowbook.TEST  '),
  'd0000000-0000-0000-0000-00000000000a'::uuid,
  'normaliza mayusculas y espacios del parametro'
);

-- No encuentra: devuelve null, no error
select is(
  public.find_auth_user_id_by_email('nadie@glowbook.test'),
  null::uuid,
  'devuelve null cuando el email no existe'
);

-- Modo de seguridad y grants
select is(
  (select prosecdef from pg_proc where oid = 'public.find_auth_user_id_by_email(text)'::regprocedure),
  true,
  'find_auth_user_id_by_email es security definer'
);

select ok(
  has_function_privilege('service_role', 'public.find_auth_user_id_by_email(text)', 'EXECUTE'),
  'service_role puede ejecutar la busqueda'
);

select ok(
  not has_function_privilege('authenticated', 'public.find_auth_user_id_by_email(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.find_auth_user_id_by_email(text)', 'EXECUTE')
  and not has_function_privilege('public', 'public.find_auth_user_id_by_email(text)', 'EXECUTE'),
  'authenticated, anon y public no pueden ejecutar la busqueda'
);

-- Un cliente de usuario recibe permission denied de verdad
set local role authenticated;
select throws_ok(
  $$select public.find_auth_user_id_by_email('owner.auth@glowbook.test')$$,
  '42501',
  null,
  'un usuario autenticado recibe permission denied al llamarla'
);

set local role anon;
select throws_ok(
  $$select public.find_auth_user_id_by_email('owner.auth@glowbook.test')$$,
  '42501',
  null,
  'anon recibe permission denied al llamarla'
);

select * from finish();
rollback;
