alter table public.expenses
  add column if not exists custom_category text;

alter table public.expenses
  drop constraint if exists expenses_custom_category_required;

alter table public.expenses
  add constraint expenses_custom_category_required
  check (
    category <> 'other'
    or custom_category is null
    or length(trim(custom_category)) > 0
  );
