alter table expenses
  add column if not exists concept text;

update expenses
set concept = coalesce(
  nullif(trim(concept), ''),
  nullif(trim(custom_category), ''),
  case category
    when 'rent' then 'Alquiler'
    when 'utilities' then 'Servicios basicos'
    when 'supplies' then 'Suministros'
    when 'maintenance' then 'Mantenimiento'
    when 'payroll' then 'Nomina/comisiones'
    else 'Otro / personalizado'
  end
)
where concept is null or trim(concept) = '';

alter table expenses
  drop constraint if exists expenses_concept_not_blank;

alter table expenses
  add constraint expenses_concept_not_blank
  check (concept is null or length(trim(concept)) > 0);
