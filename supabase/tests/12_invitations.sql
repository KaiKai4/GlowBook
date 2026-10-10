-- Caracterizacion de invitaciones de salon (F03-3, migracion 20240101000071).
-- invite_salon(p_email, p_plan_id) solo lo ejecuta un admin de plataforma; guarda el plan en la misma
-- operacion, valida que no este archivado y persiste solo el hash del token.
-- La aceptacion real la hace accept_invitation_admin (service_role, ADR 0010): valida token y email
-- y crea salon y owner. accept_invitation (cliente) no tiene EXECUTE desde 064. El plan se aplica en
-- la app (use-case accept-invitation), asi que aqui solo se comprueba que queda guardado.
begin;
select plan(14);

-- Fixtures (como postgres, saltando RLS)
insert into auth.users (id, email, aud, role) values
  ('c0000000-0000-0000-0000-00000000000c', 'admin.plataforma@glowbook.test', 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'no.admin@glowbook.test', 'authenticated', 'authenticated'),
  ('e0000000-0000-0000-0000-00000000000e', 'nuevo.salon@glowbook.test', 'authenticated', 'authenticated');

insert into platform_admins (user_id) values ('c0000000-0000-0000-0000-00000000000c');

insert into commercial_plans (id, code, name, status) values
  ('f1000000-0000-0000-0000-000000000001', 'tap-activo', 'Plan activo', 'active'),
  ('f1000000-0000-0000-0000-000000000002', 'tap-archivado', 'Plan archivado', 'archived');

-- Tabla auxiliar de la transaccion (se revierte con el rollback) para guardar los tokens emitidos.
create table public.tap_invitations (k text primary key, v text);
grant all on public.tap_invitations to authenticated;

-- 1. Un usuario que no es admin de plataforma no puede invitar.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated","email":"no.admin@glowbook.test"}',
  true
);
select throws_ok(
  $$ select public.invite_salon('intruso@glowbook.test', null) $$,
  'P0001',
  'Solo la plataforma puede invitar salones',
  'un usuario que no es admin de plataforma no puede invitar'
);

-- Sesion del admin de plataforma.
select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated","email":"admin.plataforma@glowbook.test"}',
  true
);

-- 2. Invitacion sin plan (llamada con un solo argumento): se guarda con plan_id nulo.
insert into public.tap_invitations (k, v)
  values ('sin_plan', public.invite_salon('sin.plan@glowbook.test'));

-- 3. Invitacion con plan activo: el plan queda guardado en la misma operacion.
insert into public.tap_invitations (k, v)
  values ('con_plan', public.invite_salon('nuevo.salon@glowbook.test', 'f1000000-0000-0000-0000-000000000001'));

-- 4. Plan inexistente: error 22023.
select throws_ok(
  $$ select public.invite_salon('inexistente@glowbook.test', 'f1000000-0000-0000-0000-0000000000ff') $$,
  '22023',
  'El plan no existe o está archivado',
  'un plan inexistente se rechaza con 22023'
);

-- 5. Plan archivado: error 22023.
select throws_ok(
  $$ select public.invite_salon('archivado@glowbook.test', 'f1000000-0000-0000-0000-000000000002') $$,
  '22023',
  'El plan no existe o está archivado',
  'un plan archivado se rechaza con 22023'
);

-- Lectura de la tabla como postgres (sin RLS) para comprobar lo persistido.
reset role;

-- 6. Los intentos rechazados no dejan filas (la validacion ocurre antes del insert).
select is(
  (select count(*)::int from salon_invitations where email in ('inexistente@glowbook.test', 'archivado@glowbook.test', 'intruso@glowbook.test')),
  0,
  'los intentos rechazados no dejan invitaciones'
);

-- 7. Sin plan: plan_id nulo.
select is(
  (select plan_id from salon_invitations where email = 'sin.plan@glowbook.test'),
  null::uuid,
  'la invitacion sin plan se guarda con plan_id nulo'
);

-- 8. Con plan: el plan queda guardado en la invitacion.
select is(
  (select plan_id from salon_invitations where email = 'nuevo.salon@glowbook.test'),
  'f1000000-0000-0000-0000-000000000001'::uuid,
  'la invitacion con plan guarda el plan activo'
);

-- 9. El token en claro no aparece en la tabla: se busca por valor.
select is(
  (select count(*)::int from salon_invitations si
     join public.tap_invitations t on t.k = 'con_plan'
     where si.token_hash = t.v),
  0,
  'el token en claro no se guarda en salon_invitations'
);

-- 10. Se guarda sha256(token) en hex.
select is(
  (select count(*)::int from salon_invitations si
     join public.tap_invitations t on t.k = 'con_plan'
     where si.token_hash = encode(sha256(convert_to(t.v, 'utf8')), 'hex')),
  1,
  'la tabla guarda solo el sha256 del token'
);

-- 11. Email distinto al de la invitacion: error y la invitacion sigue pendiente.
select throws_ok(
  $$ select public.accept_invitation_admin(
       (select v from public.tap_invitations where k = 'con_plan'),
       'e0000000-0000-0000-0000-00000000000e', 'otro@glowbook.test', 'Salon Nuevo', 'Duena') $$,
  'P0001',
  'Esta invitación no corresponde a esta cuenta',
  'aceptar con un email distinto al de la invitacion falla'
);

-- 12. Token y email correctos: se crea el salon y el owner.
select lives_ok(
  $$ select public.accept_invitation_admin(
       (select v from public.tap_invitations where k = 'con_plan'),
       'e0000000-0000-0000-0000-00000000000e', 'nuevo.salon@glowbook.test', 'Salon Nuevo', 'Duena') $$,
  'aceptar con el token y el email correctos crea el salon'
);

-- 13. El invitado queda como owner del salon creado.
select is(
  (select count(*)::int from profiles p
     where p.id = 'e0000000-0000-0000-0000-00000000000e' and p.is_owner = true and p.salon_id is not null),
  1,
  'el invitado queda como owner del salon nuevo'
);

-- 14. La invitacion queda aceptada, con el salon y el plan guardados para que la app lo aplique.
select is(
  (select si.status || ':' || (si.salon_id is not null)::text || ':' || coalesce(si.plan_id::text, '-')
     from salon_invitations si where si.email = 'nuevo.salon@glowbook.test'),
  'accepted:true:f1000000-0000-0000-0000-000000000001',
  'la invitacion queda aceptada con salon y plan'
);

-- 13. Reutilizar el mismo token tras aceptarlo: error (la invitacion ya no esta pendiente).
select throws_ok(
  $$ select public.accept_invitation_admin(
       (select v from public.tap_invitations where k = 'con_plan'),
       'e0000000-0000-0000-0000-00000000000e', 'nuevo.salon@glowbook.test', 'Otro Salon', 'Duena') $$,
  'P0001',
  'Invitación inválida o expirada',
  'reutilizar un token ya aceptado falla'
);

-- 14. accept_invitation (cliente) no es ejecutable por authenticated.
select ok(
  not has_function_privilege('authenticated', 'public.accept_invitation(text,text,text)', 'EXECUTE'),
  'accept_invitation no es ejecutable por authenticated'
);

select * from finish();
rollback;
