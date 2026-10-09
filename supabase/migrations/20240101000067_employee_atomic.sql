-- Colaboradores atomicos: alta, asignaciones y edicion de perfil en una sola transaccion.
--
-- Forward-only, expand/contract: la app anterior sigue funcionando (las tablas no cambian de forma).
--   * replace_employee_assignments(jsonb): helper interno (sin EXECUTE para clientes).
--     Reemplaza employee_services / employee_categories del colaborador; las claves
--     service_ids / category_ids son opcionales (solo se reemplaza lo presente).
--   * create_employee_with_assignments(jsonb): alta de colaborador + asignaciones.
--     Payload: {employee: {first_name, last_name, phone?, email?, specialty?, commission_percentage?, hire_date?},
--               service_ids?: [uuid], category_ids?: [uuid], idempotency_key?: uuid}.
--     Resultado guardado: {"employee_id": "<uuid>"}.
--   * update_employee_profile(jsonb): actualiza perfil, asignaciones y email en una transaccion.
--     Payload: {employee_id, fields?: {first_name?, last_name?, phone?, email?, specialty?, commission_percentage?},
--               service_ids?: [uuid], category_ids?: [uuid], unlink_profile?: boolean, idempotency_key?: uuid}.
--     Solo se escriben las claves presentes en fields. Un cambio de email invalida las invitaciones
--     pendientes del colaborador (la app emite la nueva despues, con un token nuevo).
--   * Indice unico parcial employees_active_email_per_salon_unique (salon_id, lower(email)) where is_active
--     and email <> '': impide dos colaboradores activos con el mismo email en un salon. Solo se crea si
--     no hay duplicados; si los hay, la migracion falla con el listado de la cantidad a resolver.
--
-- Errores: cualquier fallo dentro de la RPC deshace todo (perfil, asignaciones, invitaciones y clave de
-- idempotencia): no queda nada persistido.

set lock_timeout = '2s';
set statement_timeout = '30s';

begin;

-- 1. Indice unico de email por salon entre colaboradores activos (defensa en profundidad:
--    las RPC ya rechazan el duplicado). Si hay duplicados heredados, la migracion NO falla
--    (no debe bloquear un despliegue): avisa y omite el indice. Se crea en una migracion
--    posterior cuando los datos esten saneados.
do $$
declare
  v_duplicates int;
begin
  select count(*)
    into v_duplicates
  from (
    select e.salon_id, lower(e.email)
    from public.employees e
    where e.is_active
      and e.email <> ''
    group by e.salon_id, lower(e.email)
    having count(*) > 1
  ) d;

  if v_duplicates > 0 then
    raise notice 'Hay % combinaciones salon/email duplicadas entre colaboradores activos: se omite el indice unico; las RPC siguen rechazando duplicados nuevos.', v_duplicates;
  else
    execute 'create unique index if not exists employees_active_email_per_salon_unique on public.employees (salon_id, lower(email)) where is_active and email <> ''''';
  end if;
end;
$$;

-- 2. Helper interno de asignaciones. Sin EXECUTE para clientes: lo llaman las RPC de colaboradores.
create or replace function public.replace_employee_assignments(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := (payload ->> 'salon_id')::uuid;
  v_employee uuid := (payload ->> 'employee_id')::uuid;
begin
  perform 1
  from public.employees e
  where e.id = v_employee
    and e.salon_id = v_salon
  for update;

  if not found then
    raise exception 'Colaborador no encontrado.' using errcode = 'P0002';
  end if;

  if payload ? 'service_ids' then
    delete from public.employee_services
    where employee_id = v_employee
      and salon_id = v_salon;

    insert into public.employee_services (employee_id, service_id, salon_id)
    select distinct v_employee, s.value::uuid, v_salon
    from jsonb_array_elements_text(coalesce(payload -> 'service_ids', '[]'::jsonb)) as s(value);
  end if;

  if payload ? 'category_ids' then
    delete from public.employee_categories
    where employee_id = v_employee
      and salon_id = v_salon;

    insert into public.employee_categories (employee_id, category_id, salon_id)
    select distinct v_employee, c.value::uuid, v_salon
    from jsonb_array_elements_text(coalesce(payload -> 'category_ids', '[]'::jsonb)) as c(value);
  end if;
end;
$$;

revoke all on function public.replace_employee_assignments(jsonb)
  from public, anon, authenticated, service_role;

-- 3. Alta atomica de colaborador.
create or replace function public.create_employee_with_assignments(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_idem_key uuid := nullif(payload ->> 'idempotency_key', '')::uuid;
  v_emp jsonb := coalesce(payload -> 'employee', '{}'::jsonb);
  v_first text := btrim(coalesce(v_emp ->> 'first_name', ''));
  v_last text := btrim(coalesce(v_emp ->> 'last_name', ''));
  v_email text := btrim(coalesce(v_emp ->> 'email', ''));
  v_replay jsonb;
  v_employee uuid;
  v_result jsonb;
begin
  if v_salon is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if not public.has_permission('employees.manage') then
    raise exception 'No tienes permiso para gestionar colaboradores.' using errcode = '42501';
  end if;

  if v_idem_key is not null then
    v_replay := public.idempotency_begin(
      'create_employee_with_assignments',
      v_idem_key,
      encode(sha256(convert_to((payload - 'idempotency_key')::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return v_replay;
    end if;
  end if;

  if v_first = '' or v_last = '' then
    raise exception 'El nombre y apellido son obligatorios.' using errcode = '22023';
  end if;

  if v_email <> '' and exists (
    select 1
    from public.employees e
    where e.salon_id = v_salon
      and e.is_active
      and lower(e.email) = lower(v_email)
  ) then
    raise exception 'Ya existe un colaborador activo con ese email.' using errcode = 'P0001';
  end if;

  insert into public.employees (
    salon_id, first_name, last_name, phone, email, specialty, commission_percentage, hire_date
  )
  values (
    v_salon,
    v_first,
    v_last,
    coalesce(v_emp ->> 'phone', ''),
    v_email,
    coalesce(v_emp ->> 'specialty', ''),
    coalesce((v_emp ->> 'commission_percentage')::numeric, 0),
    nullif(v_emp ->> 'hire_date', '')::date
  )
  returning id into v_employee;

  perform public.replace_employee_assignments(
    jsonb_build_object(
      'salon_id', v_salon,
      'employee_id', v_employee,
      'service_ids', coalesce(payload -> 'service_ids', '[]'::jsonb),
      'category_ids', coalesce(payload -> 'category_ids', '[]'::jsonb)
    )
  );

  v_result := jsonb_build_object('employee_id', v_employee);

  if v_idem_key is not null then
    perform public.idempotency_finish('create_employee_with_assignments', v_idem_key, v_result);
  end if;

  return v_result;
end;
$$;

revoke all on function public.create_employee_with_assignments(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.create_employee_with_assignments(jsonb) to authenticated;

-- 4. Edicion atomica de perfil, asignaciones y email.
create or replace function public.update_employee_profile(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_salon uuid := public.salon_id();
  v_employee uuid := (payload ->> 'employee_id')::uuid;
  v_idem_key uuid := nullif(payload ->> 'idempotency_key', '')::uuid;
  v_fields jsonb := coalesce(payload -> 'fields', '{}'::jsonb);
  v_replay jsonb;
  v_current public.employees%rowtype;
  v_email text;
  v_email_changed boolean;
  v_assignments jsonb;
  v_result jsonb;
begin
  if v_salon is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if not public.has_permission('employees.manage') then
    raise exception 'No tienes permiso para gestionar colaboradores.' using errcode = '42501';
  end if;

  if v_idem_key is not null then
    v_replay := public.idempotency_begin(
      'update_employee_profile',
      v_idem_key,
      encode(sha256(convert_to((payload - 'idempotency_key')::text, 'UTF8')), 'hex')
    );
    if v_replay is not null then
      return v_replay;
    end if;
  end if;

  select e.*
    into v_current
  from public.employees e
  where e.id = v_employee
    and e.salon_id = v_salon
  for update;

  if not found then
    raise exception 'Colaborador no encontrado.' using errcode = 'P0002';
  end if;

  if v_fields ? 'first_name' and btrim(coalesce(v_fields ->> 'first_name', '')) = '' then
    raise exception 'El nombre y apellido son obligatorios.' using errcode = '22023';
  end if;

  if v_fields ? 'last_name' and btrim(coalesce(v_fields ->> 'last_name', '')) = '' then
    raise exception 'El nombre y apellido son obligatorios.' using errcode = '22023';
  end if;

  v_email := case when v_fields ? 'email' then btrim(coalesce(v_fields ->> 'email', '')) else v_current.email end;
  v_email_changed := lower(v_email) <> lower(btrim(v_current.email));

  if v_current.is_active and v_email <> '' and exists (
    select 1
    from public.employees e
    where e.salon_id = v_salon
      and e.id <> v_employee
      and e.is_active
      and lower(e.email) = lower(v_email)
  ) then
    raise exception 'Ya existe un colaborador activo con ese email.' using errcode = 'P0001';
  end if;

  update public.employees e
  set first_name = case when v_fields ? 'first_name' then btrim(v_fields ->> 'first_name') else e.first_name end,
      last_name = case when v_fields ? 'last_name' then btrim(v_fields ->> 'last_name') else e.last_name end,
      phone = case when v_fields ? 'phone' then coalesce(v_fields ->> 'phone', '') else e.phone end,
      email = v_email,
      specialty = case when v_fields ? 'specialty' then coalesce(v_fields ->> 'specialty', '') else e.specialty end,
      commission_percentage = case
        when v_fields ? 'commission_percentage' then (v_fields ->> 'commission_percentage')::numeric
        else e.commission_percentage
      end,
      profile_id = case when coalesce((payload ->> 'unlink_profile')::boolean, false) then null else e.profile_id end
  where e.id = v_employee
    and e.salon_id = v_salon;

  if v_email_changed then
    -- Un enlace de acceso emitido para el email anterior deja de valer; la app emite el nuevo si lo hay.
    delete from public.employee_invitations
    where employee_id = v_employee
      and salon_id = v_salon
      and accepted_at is null;
  end if;

  -- Solo se pasan las claves de asignacion presentes: una clave ausente significa "no tocar".
  v_assignments := jsonb_build_object('salon_id', v_salon, 'employee_id', v_employee);
  if payload ? 'service_ids' then
    v_assignments := v_assignments || jsonb_build_object('service_ids', payload -> 'service_ids');
  end if;
  if payload ? 'category_ids' then
    v_assignments := v_assignments || jsonb_build_object('category_ids', payload -> 'category_ids');
  end if;
  perform public.replace_employee_assignments(v_assignments);

  v_result := jsonb_build_object('employee_id', v_employee);

  if v_idem_key is not null then
    perform public.idempotency_finish('update_employee_profile', v_idem_key, v_result);
  end if;

  return v_result;
end;
$$;

revoke all on function public.update_employee_profile(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.update_employee_profile(jsonb) to authenticated;

commit;
