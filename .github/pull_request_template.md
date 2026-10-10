## Resumen

<!-- Qué cambia y por qué. Enlaza la issue o el ADR relacionado. -->

## Tipo de cambio

- [ ] Funcionalidad
- [ ] Correccion
- [ ] Refactor sin cambio de comportamiento
- [ ] Calidad, CI o documentacion
- [ ] Migracion de base de datos

## Checklist general

- [ ] `npm run verify:full` en verde en local (o el job equivalente de CI).
- [ ] Sin cambios que dependan de un nombre de rol: los permisos se comprueban con `has_permission`.
- [ ] Sin `any`, `@ts-ignore` ni `eslint-disable` nuevos.
- [ ] Sin archivos nuevos de mas de ~300 lineas.
- [ ] Pruebas de conducta para lo nuevo y para la regresion que se corrige (cruzan la interfaz publica).
- [ ] Documentacion afectada actualizada (`AGENTS.md`, `docs/`, `SECURITY.md`); `meta` en verde.
- [ ] ADR nuevo o actualizado si la decision no es obvia (contrato, capa, dependencia, herramienta, excepcion).

## Checklist de migraciones de base de datos

Marcar solo si el PR incluye archivos en `supabase/migrations/`. Si no aplica, dejar sin marcar y escribir "N/A".

- [ ] La migracion es compatible con la version anterior de la app (expand o cambio aditivo). Si es un contract, el nombre incluye `_contract_` y la cabecera `-- contract-of: <id>` apunta a una migracion existente.
- [ ] No hay `RENAME`, `TRUNCATE` ni `DELETE FROM` sin `WHERE`.
- [ ] Tipos regenerados con `npm run db:types` y el diff de `src/` esta incluido en el PR.
- [ ] Pruebas pgTAP añadidas o actualizadas para RLS, RPC o constraints tocados.
- [ ] `npm run verify:full` en verde con la migracion aplicada en local.
- [ ] Ningun cambio manual en produccion: todo se aplica por migracion versionada y el gate `release:migrations` es el que decide.
- [ ] ADR nuevo o actualizado si la decision no es obvia (cambio de contrato de datos, borrado, cambio de tipo, nueva politica).
- [ ] Plan de rollback o mitigacion descrito abajo (en general, un rollback de app basta si la migracion es aditiva).

## Plan de rollback o mitigacion

<!-- Obligatorio si hay migracion. -->

## Evidencia de pruebas

<!-- Comandos ejecutados y resultado. Capturas si hay cambio visual. -->

