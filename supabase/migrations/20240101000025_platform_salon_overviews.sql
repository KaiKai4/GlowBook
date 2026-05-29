create or replace function public.platform_salon_overviews()
returns table (
  id uuid,
  name text,
  email text,
  contact_email text,
  phone text,
  is_active boolean,
  created_at timestamptz,
  disabled_features text[],
  owner_names text[],
  owner_count bigint,
  customer_count bigint,
  collaborator_count bigint,
  appointment_count bigint,
  service_count bigint,
  invitation_count bigint
)
language sql
security invoker
set search_path = public
as $$
  with accepted_invitations as (
    select distinct on (salon_id)
      salon_id,
      email
    from salon_invitations
    where status = 'accepted'
      and salon_id is not null
      and email <> ''
    order by salon_id, accepted_at desc nulls last, created_at desc
  ),
  owner_stats as (
    select
      salon_id,
      coalesce(
        array_agg(full_name order by full_name)
          filter (where full_name is not null and full_name <> ''),
        '{}'::text[]
      ) as owner_names,
      count(*) as owner_count
    from profiles
    where is_owner = true
    group by salon_id
  ),
  customer_stats as (
    select salon_id, count(*) as customer_count
    from customers
    group by salon_id
  ),
  collaborator_stats as (
    select salon_id, count(*) as collaborator_count
    from employees
    group by salon_id
  ),
  appointment_stats as (
    select salon_id, count(*) as appointment_count
    from appointments
    group by salon_id
  ),
  service_stats as (
    select salon_id, count(*) as service_count
    from services
    group by salon_id
  ),
  invitation_stats as (
    select salon_id, count(*) as invitation_count
    from salon_invitations
    where salon_id is not null
    group by salon_id
  )
  select
    salons.id,
    salons.name,
    salons.email,
    coalesce(nullif(salons.email, ''), accepted_invitations.email, '') as contact_email,
    salons.phone,
    salons.is_active,
    salons.created_at,
    salons.disabled_features,
    coalesce(owner_stats.owner_names, '{}'::text[]) as owner_names,
    coalesce(owner_stats.owner_count, 0) as owner_count,
    coalesce(customer_stats.customer_count, 0) as customer_count,
    coalesce(collaborator_stats.collaborator_count, 0) as collaborator_count,
    coalesce(appointment_stats.appointment_count, 0) as appointment_count,
    coalesce(service_stats.service_count, 0) as service_count,
    coalesce(invitation_stats.invitation_count, 0) as invitation_count
  from salons
  left join accepted_invitations on accepted_invitations.salon_id = salons.id
  left join owner_stats on owner_stats.salon_id = salons.id
  left join customer_stats on customer_stats.salon_id = salons.id
  left join collaborator_stats on collaborator_stats.salon_id = salons.id
  left join appointment_stats on appointment_stats.salon_id = salons.id
  left join service_stats on service_stats.salon_id = salons.id
  left join invitation_stats on invitation_stats.salon_id = salons.id
  order by salons.created_at desc;
$$;
