update salons
set disabled_features = (
  select coalesce(array_agg(distinct feature), '{}'::text[])
  from unnest(disabled_features) as disabled_feature(feature)
  where feature = any (
    array[
      'appointments',
      'recordatorios',
      'customers',
      'employees',
      'services',
      'reports',
      'roles',
      'plantillas',
      'salon'
    ]::text[]
  )
);

do $$
begin
  alter table salons
    add constraint salons_disabled_features_allowed
    check (
      array_position(disabled_features, null) is null
      and disabled_features <@ array[
        'appointments',
        'recordatorios',
        'customers',
        'employees',
        'services',
        'reports',
        'roles',
        'plantillas',
        'salon'
      ]::text[]
    );
exception
  when duplicate_object then null;
end $$;
