-- Comportamiento de public.delete_salon_completely(uuid) (F03-1).
-- Siembra un salon con al menos una fila en TODA tabla de public con columna salon_id y comprueba
-- que el borrado no deja ninguna fila de ese salon y que el salon de control conserva sus datos.
-- Si aparece una tabla nueva con salon_id sin tratar en la RPC, la comprobacion de cobertura
-- (10b_delete_salon_catalog.sql) falla y esta prueba tambien detecta las filas huerfanas.
-- Corre como postgres (salta RLS). El trigger ensure_salon_has_owner solo deja borrar al owner
-- con el rol service_role, igual que en produccion, asi que se simula con request.jwt.claims.
begin;
select plan(6);

-- Filas de un salon en todas las tablas public con columna salon_id.
create function public.tap_salon_rows(p_salon uuid) returns table(tbl text, n bigint)
language plpgsql as $$
declare r record;
begin
  for r in
    select c.relname::text as t
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r'
      and a.attname = 'salon_id' and not a.attisdropped
    order by 1
  loop
    tbl := r.t;
    execute format('select count(*) from public.%I where salon_id = $1', r.t) into n using p_salon;
    return next;
  end loop;
end $$;

-- Siembra completa de un salon (fixtures dentro de la transaccion; el rollback las elimina).
create function public.tap_seed_salon(p_salon uuid, p_tag text) returns void
language plpgsql as $$
declare
  v_user uuid := gen_random_uuid();
  v_perm uuid;
  v_plan uuid := gen_random_uuid();
  v_role uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_svc uuid := gen_random_uuid();
  v_emp uuid := gen_random_uuid();
  v_cust uuid := gen_random_uuid();
  v_appt uuid := gen_random_uuid();
  v_tmpl uuid := gen_random_uuid();
  v_prod uuid := gen_random_uuid();
  v_pur uuid := gen_random_uuid();
  v_sale uuid := gen_random_uuid();
begin
  select id into v_perm from permissions limit 1;
  insert into commercial_plans (id, code, name) values (v_plan, 'test-' || p_tag, 'Plan ' || p_tag);

  insert into auth.users (id, email, aud, role)
    values (v_user, p_tag || '.owner@glowbook.test', 'authenticated', 'authenticated');

  insert into roles (id, salon_id, name) values (v_role, p_salon, 'Rol ' || p_tag);
  insert into role_permissions (salon_id, role_id, permission_id) values (p_salon, v_role, v_perm);
  insert into profiles (id, salon_id, is_owner, full_name, role_id)
    values (v_user, p_salon, true, 'Owner ' || p_tag, v_role);

  insert into salon_business_hours (salon_id, day_of_week, is_open, open_time, close_time)
    values (p_salon, 1, true, '09:00', '18:00');

  insert into service_categories (id, salon_id, name) values (v_cat, p_salon, 'Cat ' || p_tag);
  insert into services (id, salon_id, category_id, name, duration_minutes, price)
    values (v_svc, p_salon, v_cat, 'Serv ' || p_tag, 30, 15);
  insert into employees (id, salon_id, first_name, last_name) values (v_emp, p_salon, 'Emp', p_tag);
  insert into employee_services (salon_id, employee_id, service_id) values (p_salon, v_emp, v_svc);
  insert into employee_categories (salon_id, employee_id, category_id) values (p_salon, v_emp, v_cat);
  insert into work_schedules (salon_id, employee_id, day_of_week, start_time, end_time)
    values (p_salon, v_emp, 1, '09:00', '17:00');
  insert into schedule_exceptions (salon_id, employee_id, exception_date)
    values (p_salon, v_emp, '2030-01-08');
  insert into employee_invitations (salon_id, employee_id, email, token_hash)
    values (p_salon, v_emp, p_tag || '.emp@glowbook.test', 'hash-' || p_tag);

  insert into customers (id, salon_id, first_name, last_name) values (v_cust, p_salon, 'Cli', p_tag);
  insert into appointments (id, salon_id, customer_id, created_by) values (v_appt, p_salon, v_cust, v_user);
  insert into appointment_items (salon_id, appointment_id, service_id, employee_id, start_time, end_time, duration_minutes, price, ordering)
    values (p_salon, v_appt, v_svc, v_emp, '2030-01-07 20:00:00+00', '2030-01-07 20:30:00+00', 30, 15, 0);

  insert into notification_templates (id, salon_id, name, channel, event, recipient, body_text)
    values (v_tmpl, p_salon, 'Recordatorio ' || p_tag, 'email', 'appointment_reminder', 'customer', 'Hola');
  insert into appointment_reminder_log (salon_id, appointment_id, channel, template_id)
    values (p_salon, v_appt, 'email', v_tmpl);
  insert into feedback_reports (salon_id, message, created_by) values (p_salon, 'Hola', v_user);
  insert into expenses (salon_id, amount, category) values (p_salon, 10, 'rent');

  insert into inventory_products (id, salon_id, name) values (v_prod, p_salon, 'Producto ' || p_tag);
  insert into inventory_stock_locations (salon_id, product_id, location) values (p_salon, v_prod, 'retail');
  insert into inventory_purchases (id, salon_id, total_cost) values (v_pur, p_salon, 5);
  insert into inventory_purchase_items (salon_id, purchase_id, product_id, location, quantity, unit_cost, total_cost)
    values (p_salon, v_pur, v_prod, 'retail', 5, 1, 5);
  insert into inventory_movements (salon_id, product_id, location, movement_type, quantity_delta, quantity_after)
    values (p_salon, v_prod, 'retail', 'purchase', 5, 5);
  insert into retail_sales (id, salon_id, payment_method, total_amount) values (v_sale, p_salon, 'cash', 10);
  insert into retail_sale_items (salon_id, sale_id, product_id, location, quantity, unit_price, total_price)
    values (p_salon, v_sale, v_prod, 'retail', 1, 10, 10);

  insert into salon_plan_assignments (salon_id, plan_id) values (p_salon, v_plan);
  insert into salon_plan_overrides (salon_id, module_key) values (p_salon, (select key from platform_modules limit 1));
  insert into salon_plan_alerts (salon_id, message, severity) values (p_salon, 'Aviso ' || p_tag, 'info');
  insert into salon_plan_payments (salon_id, amount, period_start, period_end)
    values (p_salon, 10, '2030-01-01', '2030-01-31');

  insert into salon_invitations (salon_id, email, invited_by, token_hash)
    values (p_salon, p_tag || '.inv@glowbook.test', v_user, 'tok-' || p_tag);
  insert into salon_activity_log (salon_id, action, table_name) values (p_salon, 'insert', 'roles');
end $$;

-- Fixtures: dos salones, A (se borra) y B (control).
insert into salons (id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'Salon A'),
  ('b1000000-0000-0000-0000-000000000002', 'Salon B');

do $$ begin
  perform tap_seed_salon('a1000000-0000-0000-0000-000000000001', 'a');
  perform tap_seed_salon('b1000000-0000-0000-0000-000000000002', 'b');
end $$;

-- 1 y 2: la siembra cubre todas las tablas con salon_id (y son al menos 32 tablas).
select ok(
  not exists (select 1 from tap_salon_rows('a1000000-0000-0000-0000-000000000001') where n = 0),
  'la siembra deja al menos una fila en cada tabla con salon_id'
);
select cmp_ok(
  (select count(*)::int from tap_salon_rows('a1000000-0000-0000-0000-000000000001')),
  '>=', 32,
  'hay al menos 32 tablas con salon_id que cubrir'
);

-- 3: la RPC se ejecuta como service_role (el trigger de owner lo permite) sin error.
do $$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $$;
select lives_ok(
  $$ select * from public.delete_salon_completely('a1000000-0000-0000-0000-000000000001') $$,
  'delete_salon_completely ejecuta sin error sobre un salon con datos en todas las tablas'
);

-- 4: no queda ninguna fila del salon borrado en ninguna tabla.
select is(
  (select string_agg(tbl, ', ' order by tbl) from tap_salon_rows('a1000000-0000-0000-0000-000000000001') where n > 0),
  null::text,
  'no queda ninguna fila del salon borrado en ninguna tabla con salon_id'
);

-- 5: el salon ya no existe.
select ok(
  not exists (select 1 from salons where id = 'a1000000-0000-0000-0000-000000000001'),
  'la fila de salons del salon borrado ya no existe'
);

-- 6: el salon de control conserva filas en todas las tablas.
select ok(
  not exists (select 1 from tap_salon_rows('b1000000-0000-0000-0000-000000000002') where n = 0),
  'el salon de control conserva sus datos en todas las tablas'
);

select * from finish();
rollback;
