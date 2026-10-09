-- Caracterizacion del aislamiento multi-tenant (RLS) entre dos salones.
-- El owner del salon A no debe ver, insertar, actualizar ni borrar filas del salon B
-- en ninguna tabla con columna salon_id. Los asserts recorren pg_attribute de forma sistematica.
-- La comprobacion "no ve filas de B" solo es significativa donde B tiene datos: por eso
-- se siembran filas de B en las tablas de negocio principales y se verifica la siembra.
begin;
select plan(10);

-- Fixtures (como postgres, saltando RLS)
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner.a@glowbook.test', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'owner.b@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'Salon A'),
  ('b1000000-0000-0000-0000-000000000002', 'Salon B');

insert into profiles (id, salon_id, is_owner, full_name) values
  ('a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', true, 'Owner A'),
  ('b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000002', true, 'Owner B');

insert into service_categories (id, salon_id, name) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Cat A'),
  ('b2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Cat B');

insert into services (id, salon_id, category_id, name, duration_minutes, price) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Serv A', 30, 15),
  ('b3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'Serv B', 30, 15);

insert into employees (id, salon_id, first_name, last_name) values
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Emp', 'A'),
  ('b4000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Emp', 'B');

insert into customers (id, salon_id, first_name, last_name) values
  ('a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Cli', 'A'),
  ('b5000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Cli', 'B');

insert into appointments (id, salon_id, customer_id, created_by) values
  ('ab000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a'),
  ('bb000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'b5000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b');

insert into appointment_items (salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering) values
  ('a1000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', '2030-01-07 20:00:00+00', '2030-01-07 20:30:00+00', 30, 15, 0),
  ('b1000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000002', 'b4000000-0000-0000-0000-000000000002', '2030-01-07 20:00:00+00', '2030-01-07 20:30:00+00', 30, 15, 0);

-- Helpers en public: se crean dentro de la transaccion y desaparecen con el rollback.
-- Se ejecutan bajo el rol que llama (authenticated), por lo que aplican RLS.
create function public.tap_visible_rows(p_table text, p_salon uuid) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where salon_id = $1', p_table) into n using p_salon;
  return n;
end $$;

create function public.tap_mutate_rows(p_table text, p_salon uuid, p_op text) returns bigint
language plpgsql as $$
declare n bigint := 0;
begin
  if p_op = 'update' then
    execute format('update public.%I set salon_id = salon_id where salon_id = $1', p_table) using p_salon;
  else
    execute format('delete from public.%I where salon_id = $1', p_table) using p_salon;
  end if;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  -- Denegado por permisos o por RLS (WITH CHECK): cuenta como aislado.
  return 0;
end $$;

-- Controles: la siembra de B existe (si no, las pruebas serian vacuas)
select is(
  (select count(*)::int from appointment_items where salon_id = 'b1000000-0000-0000-0000-000000000002'),
  1,
  'control: el salon B tiene una cita con items sembrada'
);

select is(
  (select count(*)::int from customers where salon_id = 'b1000000-0000-0000-0000-000000000002'),
  1,
  'control: el salon B tiene clientes sembrados'
);

-- Sesion del owner A (rol authenticated + claims como los emite el Auth Hook)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","salon_id":"a1000000-0000-0000-0000-000000000001"}',
  true
);

select is(
  public.tap_visible_rows('customers', 'a1000000-0000-0000-0000-000000000001'),
  1::bigint,
  'control: el owner A ve sus propios clientes (la sesion funciona)'
);

select is(
  (
    select coalesce(sum(public.tap_visible_rows(c.relname::text, 'b1000000-0000-0000-0000-000000000002')), 0)::bigint
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'salon_id'
      and not a.attisdropped
  ),
  0::bigint,
  'owner A no ve ninguna fila del salon B en ninguna tabla con salon_id'
);

select is(
  (
    select coalesce(sum(public.tap_mutate_rows(c.relname::text, 'b1000000-0000-0000-0000-000000000002', 'update')), 0)::bigint
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'salon_id'
      and not a.attisdropped
  ),
  0::bigint,
  'owner A no puede actualizar filas del salon B en ninguna tabla con salon_id'
);

select is(
  (
    select coalesce(sum(public.tap_mutate_rows(c.relname::text, 'b1000000-0000-0000-0000-000000000002', 'delete')), 0)::bigint
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'salon_id'
      and not a.attisdropped
  ),
  0::bigint,
  'owner A no puede borrar filas del salon B en ninguna tabla con salon_id'
);

select throws_ok(
  $q$insert into customers (salon_id, first_name, last_name) values ('b1000000-0000-0000-0000-000000000002', 'Intruso', 'A')$q$,
  '42501',
  null,
  'owner A no puede insertar clientes en el salon B'
);

select throws_ok(
  $q$insert into services (salon_id, category_id, name, duration_minutes, price) values ('b1000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'Intruso', 30, 1)$q$,
  '42501',
  null,
  'owner A no puede insertar servicios en el salon B'
);

select throws_ok(
  $q$insert into employees (salon_id, first_name, last_name) values ('b1000000-0000-0000-0000-000000000002', 'Intruso', 'A')$q$,
  '42501',
  null,
  'owner A no puede insertar colaboradores en el salon B'
);

select lives_ok(
  $q$insert into customers (salon_id, first_name, last_name) values ('a1000000-0000-0000-0000-000000000001', 'Nuevo', 'A')$q$,
  'control: el owner A si puede insertar clientes en su propio salon'
);

select * from finish();
rollback;
