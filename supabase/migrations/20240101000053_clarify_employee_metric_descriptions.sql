-- La duena cuenta dentro de estos limites: ella es un colaborador activo
-- (atiende citas) y tiene una cuenta con acceso. Dejarlo explicito evita
-- configurar 0 por error y "superar" el limite con solo existir.

update commercial_limit_metrics set
  description = 'Personas que atienden citas, incluida la duena. Si la duena trabaja sola, el minimo util es 1.',
  updated_at = now()
where key = 'employees.active';

update commercial_limit_metrics set
  description = 'Cuentas que pueden iniciar sesion, incluida la duena. El minimo util es 1; los accesos adicionales se venden como extra.',
  updated_at = now()
where key = 'employees.login_users';
