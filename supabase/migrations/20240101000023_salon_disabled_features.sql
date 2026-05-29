alter table salons
  add column if not exists disabled_features text[] not null default '{}';
