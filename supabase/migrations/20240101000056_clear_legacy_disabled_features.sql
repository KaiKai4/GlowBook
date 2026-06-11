-- La columna legacy salons.disabled_features solo gobierna salones SIN plan
-- comercial (fallback historico). Para salones con plan asignado, el plan y
-- sus overrides son la unica fuente de verdad de modulos, asi que el residuo
-- legacy se limpia: evita configuracion fantasma que ninguna UI puede editar.
update salons
set disabled_features = '{}'
where disabled_features <> '{}'
  and id in (
    select salon_id from salon_plan_assignments
    where status in ('trialing', 'active')
  );
