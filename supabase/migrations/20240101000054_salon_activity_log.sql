-- Trazabilidad por salon: registra quien hizo que y cuando sobre las tablas
-- operativas. Se llena con triggers para cubrir todas las rutas de escritura
-- sin depender de que cada server action lo recuerde.

create table salon_activity_log (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  actor_id uuid,
  actor_email text not null default '',
  table_name text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  record_id uuid,
  record_label text not null default '',
  created_at timestamptz not null default now()
);

create index idx_salon_activity_log_salon_created
  on salon_activity_log (salon_id, created_at desc);

alter table salon_activity_log enable row level security;

-- Lectura: miembros del salon con permiso de configuracion, o plataforma.
create policy salon_activity_log_select on salon_activity_log for select
  using (
    (salon_id = (select public.salon_id()) and (select public.has_permission('salon.manage')))
    or (select public.is_platform_admin())
  );
-- Escritura solo via trigger (security definer); nadie inserta directo.

create or replace function public.log_salon_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_salon uuid;
  v_label text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_salon := case
    when tg_table_name = 'salons' then (v_row ->> 'id')::uuid
    else (v_row ->> 'salon_id')::uuid
  end;
  if v_salon is null then
    return coalesce(new, old);
  end if;

  -- Etiqueta humana del registro segun los campos que tenga la tabla.
  v_label := coalesce(
    nullif(trim(concat(v_row ->> 'first_name', ' ', v_row ->> 'last_name')), ''),
    v_row ->> 'name',
    v_row ->> 'concept',
    v_row ->> 'customer_name',
    ''
  );

  insert into salon_activity_log (salon_id, actor_id, actor_email, table_name, action, record_id, record_label)
  values (
    v_salon,
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', 'sistema'),
    tg_table_name,
    lower(tg_op),
    (v_row ->> 'id')::uuid,
    left(v_label, 120)
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function public.log_salon_activity() from public, anon, authenticated;

create trigger trg_activity_appointments
  after insert or update or delete on appointments
  for each row execute function public.log_salon_activity();
create trigger trg_activity_customers
  after insert or update or delete on customers
  for each row execute function public.log_salon_activity();
create trigger trg_activity_services
  after insert or update or delete on services
  for each row execute function public.log_salon_activity();
create trigger trg_activity_employees
  after insert or update or delete on employees
  for each row execute function public.log_salon_activity();
create trigger trg_activity_expenses
  after insert or update or delete on expenses
  for each row execute function public.log_salon_activity();
create trigger trg_activity_retail_sales
  after insert or update or delete on retail_sales
  for each row execute function public.log_salon_activity();
create trigger trg_activity_inventory_products
  after insert or update or delete on inventory_products
  for each row execute function public.log_salon_activity();
create trigger trg_activity_inventory_movements
  after insert or delete on inventory_movements
  for each row execute function public.log_salon_activity();
create trigger trg_activity_roles
  after insert or update or delete on roles
  for each row execute function public.log_salon_activity();
create trigger trg_activity_salons
  after update on salons
  for each row execute function public.log_salon_activity();
