-- Caracterizacion de salon_activity_log (migracion 054): triggers log_salon_activity y su RLS.
-- Diez triggers registran insert/update/delete en: appointments, customers, services, employees, expenses,
-- retail_sales, inventory_products, inventory_movements (solo insert y delete), roles y salons (solo update).
-- La etiqueta (record_label) sale de first_name+last_name, name, concept o customer_name; si no hay ninguno, queda ''.
-- Lectura: solo miembros con salon.manage de ESE salon, o administradores de plataforma. Escritura: solo trigger.
begin;
select plan(28);

-- Fixtures (como postgres, saltando RLS)
insert into auth.users (id, email, aud, role) values
  ('a7000000-0000-0000-0000-000000000001', 'owner.log@glowbook.test', 'authenticated', 'authenticated'),
  ('a7000000-0000-0000-0000-000000000002', 'miembro.log@glowbook.test', 'authenticated', 'authenticated'),
  ('a7000000-0000-0000-0000-000000000003', 'gestor.log@glowbook.test', 'authenticated', 'authenticated'),
  ('a7000000-0000-0000-0000-000000000004', 'plataforma.log@glowbook.test', 'authenticated', 'authenticated'),
  ('a7000000-0000-0000-0000-000000000005', 'owner.m2.log@glowbook.test', 'authenticated', 'authenticated');

insert into salons (id, name) values
  ('a8000000-0000-0000-0000-000000000001', 'Salon Log L'),
  ('a8000000-0000-0000-0000-000000000002', 'Salon Log M2');

insert into roles (id, salon_id, name) values
  ('a8100000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'Citas'),
  ('a8100000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000001', 'Gestor');

insert into role_permissions (role_id, permission_id, salon_id) values
  ('a8100000-0000-0000-0000-000000000001',
   (select id from permissions where key = 'appointments.manage'),
   'a8000000-0000-0000-0000-000000000001'),
  ('a8100000-0000-0000-0000-000000000002',
   (select id from permissions where key = 'salon.manage'),
   'a8000000-0000-0000-0000-000000000001');

insert into profiles (id, salon_id, role_id, is_owner, full_name) values
  ('a7000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', null, true, 'Owner L'),
  ('a7000000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000001', false, 'Miembro citas'),
  ('a7000000-0000-0000-0000-000000000003', 'a8000000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000002', false, 'Gestor L'),
  ('a7000000-0000-0000-0000-000000000005', 'a8000000-0000-0000-0000-000000000002', null, true, 'Owner M2');

insert into platform_admins (user_id) values
  ('a7000000-0000-0000-0000-000000000004');

insert into service_categories (id, salon_id, name) values
  ('a8200000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'Cat Log');

-- Datos del salon M2 (otro tenant) y un cliente de L para la cita de prueba
insert into customers (id, salon_id, first_name, last_name) values
  ('b9000000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000002', 'Cli', 'M2'),
  ('a9000000-0000-0000-0000-000000000004', 'a8000000-0000-0000-0000-000000000001', 'Cli', 'Para cita');

-- Helper: cuenta filas de actividad visibles para la sesion actual (RLS activo, security invoker).
-- Si la sesion no tiene permiso de tabla, cuenta como 0 (aislado).
create function public.tap_count_log(p_salon uuid) returns bigint
language plpgsql as $$
declare n bigint;
begin
  select count(*) into n from public.salon_activity_log where salon_id = p_salon;
  return n;
exception when insufficient_privilege then
  return 0;
end $$;

-- 1-6. El owner de L crea un cliente: se registra con su actor, su email, la etiqueta y el salon
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a7000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner.log@glowbook.test","salon_id":"a8000000-0000-0000-0000-000000000001"}',
  true
);

select lives_ok(
  $q$insert into customers (id, salon_id, first_name, last_name) values
     ('a9000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'Ana', 'Lopez')$q$,
  'control: el owner de L puede crear un cliente en su salon'
);

select is(
  (select count(*) from salon_activity_log
    where table_name = 'customers' and action = 'insert' and record_id = 'a9000000-0000-0000-0000-000000000001'),
  1::bigint,
  'el insert de un cliente deja exactamente una fila de actividad'
);

select is(
  (select actor_id from salon_activity_log
    where table_name = 'customers' and action = 'insert' and record_id = 'a9000000-0000-0000-0000-000000000001'),
  'a7000000-0000-0000-0000-000000000001'::uuid,
  'el actor de la actividad es auth.uid() del usuario que escribe'
);

select is(
  (select actor_email from salon_activity_log
    where table_name = 'customers' and action = 'insert' and record_id = 'a9000000-0000-0000-0000-000000000001'),
  'owner.log@glowbook.test',
  'el email del actor sale del claim email del JWT'
);

select is(
  (select record_label from salon_activity_log
    where table_name = 'customers' and action = 'insert' and record_id = 'a9000000-0000-0000-0000-000000000001'),
  'Ana Lopez',
  'la etiqueta del cliente es nombre y apellido'
);

select is(
  (select salon_id from salon_activity_log
    where table_name = 'customers' and action = 'insert' and record_id = 'a9000000-0000-0000-0000-000000000001'),
  'a8000000-0000-0000-0000-000000000001'::uuid,
  'la actividad se registra en el salon del registro'
);

-- 7-10. Update y delete: el delete usa la fila OLD para la etiqueta
select lives_ok(
  $q$update customers set last_name = 'Gomez' where id = 'a9000000-0000-0000-0000-000000000001'$q$,
  'control: el owner puede editar el cliente'
);

select is(
  (select record_label from salon_activity_log
    where table_name = 'customers' and action = 'update' and record_id = 'a9000000-0000-0000-0000-000000000001'),
  'Ana Gomez',
  'el update registra la etiqueta nueva (fila NEW)'
);

select lives_ok(
  $q$delete from customers where id = 'a9000000-0000-0000-0000-000000000001'$q$,
  'control: el owner puede borrar el cliente (no tiene citas)'
);

select is(
  (select record_label from salon_activity_log
    where table_name = 'customers' and action = 'delete' and record_id = 'a9000000-0000-0000-0000-000000000001'),
  'Ana Gomez',
  'el delete registra la etiqueta de la fila borrada (fila OLD)'
);

-- 11-18. Otras tablas: services y employees (nombre propio), salons (solo update) y roles (name)
select lives_ok(
  $q$insert into services (id, salon_id, category_id, name, duration_minutes, price) values
     ('a9100000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'a8200000-0000-0000-0000-000000000001', 'Corte Premium', 30, 20)$q$,
  'control: el owner puede crear un servicio'
);

select is(
  (select record_label from salon_activity_log where table_name = 'services' and action = 'insert' and record_id = 'a9100000-0000-0000-0000-000000000001'),
  'Corte Premium',
  'un servicio se registra con su nombre como etiqueta'
);

select lives_ok(
  $q$insert into employees (id, salon_id, first_name, last_name) values
     ('a9200000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'Lucia', 'Mora')$q$,
  'control: el owner puede crear un colaborador'
);

select is(
  (select record_label from salon_activity_log where table_name = 'employees' and action = 'insert' and record_id = 'a9200000-0000-0000-0000-000000000001'),
  'Lucia Mora',
  'un colaborador se registra con nombre y apellido como etiqueta'
);

select lives_ok(
  $q$update salons set name = 'Salon Log L renombrado' where id = 'a8000000-0000-0000-0000-000000000001'$q$,
  'control: el owner (salon.manage) puede renombrar el salon'
);

select is(
  (select count(*) from salon_activity_log
    where table_name = 'salons' and action = 'update' and salon_id = 'a8000000-0000-0000-0000-000000000001'
      and record_id = 'a8000000-0000-0000-0000-000000000001'),
  1::bigint,
  'el update de salons se registra con salon_id = id del salon'
);

select lives_ok(
  $q$insert into roles (id, salon_id, name) values
     ('a8100000-0000-0000-0000-000000000003', 'a8000000-0000-0000-0000-000000000001', 'Recepcion')$q$,
  'control: el owner puede crear un rol'
);

select is(
  (select record_label from salon_activity_log where table_name = 'roles' and action = 'insert' and record_id = 'a8100000-0000-0000-0000-000000000003'),
  'Recepcion',
  'un rol se registra con su name como etiqueta'
);

-- 19. Escritura sin sesion (postgres, sin claims): actor 'sistema' y etiqueta vacia si la tabla no tiene nombre
reset role;
-- Claims vacios: auth.uid() y auth.jwt() quedan a null, como en un proceso sin sesion
select set_config('request.jwt.claims', '{}', true);
insert into appointments (id, salon_id, customer_id) values
  ('ab000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000004');

select ok(
  (select actor_email = 'sistema' and actor_id is null and record_label = ''
     from salon_activity_log where table_name = 'appointments' and action = 'insert' and record_id = 'ab000000-0000-0000-0000-000000000001'),
  'sin sesion el actor es "sistema" y una cita (sin nombre propio) queda con etiqueta vacia'
);

-- 20-22. Lectura por salon: un miembro sin salon.manage no ve nada; el gestor ve solo su salon
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a7000000-0000-0000-0000-000000000002","role":"authenticated","email":"miembro.log@glowbook.test","salon_id":"a8000000-0000-0000-0000-000000000001"}',
  true
);

select is(
  public.tap_count_log('a8000000-0000-0000-0000-000000000001'),
  0::bigint,
  'un miembro sin salon.manage no lee la actividad de su salon'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a7000000-0000-0000-0000-000000000003","role":"authenticated","email":"gestor.log@glowbook.test","salon_id":"a8000000-0000-0000-0000-000000000001"}',
  true
);

select ok(
  public.tap_count_log('a8000000-0000-0000-0000-000000000001') > 0,
  'un miembro con salon.manage lee la actividad de su salon'
);

select is(
  public.tap_count_log('a8000000-0000-0000-0000-000000000002'),
  0::bigint,
  'el gestor de L no lee la actividad del salon M2'
);

-- 23. El owner de L no ve la actividad de M2 (aislamiento entre salones)
select set_config(
  'request.jwt.claims',
  '{"sub":"a7000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner.log@glowbook.test","salon_id":"a8000000-0000-0000-0000-000000000001"}',
  true
);

select is(
  public.tap_count_log('a8000000-0000-0000-0000-000000000002'),
  0::bigint,
  'el owner de L no ve ninguna actividad del salon M2'
);

-- 24. El administrador de plataforma (sin salon) ve la actividad de ambos salones
select set_config(
  'request.jwt.claims',
  '{"sub":"a7000000-0000-0000-0000-000000000004","role":"authenticated","email":"plataforma.log@glowbook.test"}',
  true
);

select ok(
  public.tap_count_log('a8000000-0000-0000-0000-000000000001') > 0
  and public.tap_count_log('a8000000-0000-0000-0000-000000000002') > 0,
  'un administrador de plataforma lee la actividad de cualquier salon'
);

-- 25. Anonimo: no ve nada (si no tiene permiso de tabla, cuenta como aislado)
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  public.tap_count_log('a8000000-0000-0000-0000-000000000001') + public.tap_count_log('a8000000-0000-0000-0000-000000000002'),
  0::bigint,
  'anon no lee ninguna fila de salon_activity_log'
);

-- 26-27. Escritura directa denegada y funcion no ejecutable por clientes
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a7000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner.log@glowbook.test","salon_id":"a8000000-0000-0000-0000-000000000001"}',
  true
);

select throws_ok(
  $q$insert into salon_activity_log (salon_id, table_name, action, record_label)
     values ('a8000000-0000-0000-0000-000000000001', 'customers', 'insert', 'falso')$q$,
  '42501',
  null,
  'nadie inserta actividad directamente: solo el trigger'
);

select ok(
  not has_function_privilege('authenticated', 'public.log_salon_activity()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.log_salon_activity()', 'EXECUTE'),
  'log_salon_activity no es ejecutable por authenticated ni por anon'
);

-- 28. Cobertura: diez triggers de actividad instalados (ver cabecera de este archivo)
reset role;
select is(
  (select count(*) from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal and t.tgname like 'trg_activity_%'),
  10::bigint,
  'hay diez triggers de actividad instalados (appointments, customers, services, employees, expenses, retail_sales, inventory_products, inventory_movements, roles, salons)'
);

select * from finish();
rollback;
