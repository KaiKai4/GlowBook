# ADR 0024: Lecturas de billing del inquilino con RLS y escrituras de plataforma acotadas

- **Estado**: Aceptada. Revisa y acota la parte de billing de ADR 0010.
- **Fecha**: 2026-10-10

## Contexto

Billing (F05) lee datos que pertenecen al propio salón: plan efectivo, módulos y límites del plan, overrides, alertas abiertas y conteos de uso. Hasta ahora todas esas lecturas usaban `billingDb()` (cliente `service_role`, que bypasa RLS). ADR 0010 lo permitía para "entitlement checks" del servidor, pero el criterio era amplio y el salón no tenía ninguna razón para necesitar `service_role` en sus propios datos.

Usar `service_role` para datos del propio salón tiene tres costes:

- Cualquier error de filtro en el repositorio expone datos de otro salón sin que la base de datos lo impida.
- La RLS de las tablas de billing nunca se ejercita en el camino real de la aplicación, así que sus fallos no se detectan en uso.
- Las políticas existentes (`18_platform_rls.sql`) tenían huecos: los miembros del salón leían overrides, alertas y pagos completos (motivo, notas, importes, regalos), los borradores de planes eran visibles para cualquier autenticado y las tablas hijas del plan eran legibles por `anon`.

La revisión de las políticas de `supabase/tests/18_platform_rls.sql` (pruebas pgTAP, paso `db-tests`) detectó la exposición de campos internos a los miembros del salón. Ese hallazgo obligó a cerrar antes la RLS para poder pasar las lecturas a RLS.

## Decisión

1. **Lecturas del inquilino con RLS.** Las lecturas que hace un salón sobre sus propios datos usan el cliente del usuario (`billingSalonDb()`, `createSupabaseServerClient()`), de modo que la RLS es la autoridad final de aislamiento (ADR 0001):
   - Plan efectivo: `findEffectivePlanRowsForSalon` (métricas, plan asignado, módulos y límites, overrides y asignación en las columnas concedidas).
   - Alertas abiertas: `findOpenSalonAlerts` y `hasOpenPlanAlert`.
   - Conteo de uso: `count_salon_usage` (ver punto 4).
2. **Columnas mínimas por GRANT.** Las tablas con datos internos no se leen completas. `salon_plan_overrides`, `salon_plan_alerts` y `salon_plan_assignments` pierden el `select` de tabla y reciben `grant select (columnas)` a `authenticated`. Quedan fuera `reason`, `price_override` e `is_gift` (overrides), `notes` (asignación) y los pagos completos (`salon_plan_payments` solo para plataforma).
3. **Plataforma con service_role.** El panel `/admin` (suscripciones, detalle, extras, pagos, notas y alta de planes) sigue usando `billingDb()`, porque necesita columnas que el inquilino no puede leer y lecturas cross-tenant. Solo se usa tras `requirePlatformAdmin()` o un flujo sin sesión de salón (alta por invitación), como ya establecía ADR 0010.
4. **Escrituras de plataforma acotadas.** Las escrituras de plataforma que afectan a una fila de un salón concreto filtran siempre por `salon_id` y comprueban que la actualización afecta exactamente a una fila (`expectOneUpdatedRow`). Cero filas (otro salón o id inexistente) o varias (filtro ambiguo) son error, nunca éxito silencioso.
5. **RPC security definer acotadas al claim.** Solo dos funciones de billing son `security definer`, y ambas tienen guarda interna:
   - `count_salon_usage(p_salon_id, p_counters)`: cuenta aunque la RLS del llamante oculte filas (un miembro sin permiso de lectura no puede ver menos filas y saltarse un límite). Solo cuenta el salón de la sesión o, si es plataforma, cualquiera. `service_role` no pasa por la guarda (backend admin).
   - `record_plan_alert(p_plan_id, p_metric_key, p_module_key, p_severity, p_message)`: no recibe `salon_id`. La alerta siempre se crea para `public.salon_id()` de la sesión, así que un usuario no puede crear avisos para otro salón.

   Ambas usan `set search_path = public, pg_temp`, `revoke execute` de `public` y `anon`, y grant solo a `authenticated` (y `service_role` en el conteo).

## Consecuencias

- El salón deja de depender de `service_role` para sus lecturas de billing. Un fallo de filtro en un repositorio del salón ya no expone datos ajenos: lo bloquea la RLS.
- La RLS de billing se ejercita en cada petición del inquilino, así que sus errores aparecen en uso y en pruebas.
- Las columnas internas (motivo, notas, importes especiales, regalos, pagos) quedan solo para plataforma. Un nuevo campo interno debe añadirse a la lista de `grant` o quedará fuera por defecto.
- `billingSalonDb()` solo se usa en el composition root y en casos de uso del salón. Cualquier lectura nueva de datos de otro salón debe ir por `billingDb()` y pasar por plataforma.
- Coste: las RPC `security definer` siguen siendo superficie pública. Su firma, grants y guarda forman contrato y se documentan en `docs/database-contracts.md`. Cambiarlas exige una migración nueva (ADR 0016).
- Las pruebas pgTAP de aislamiento de billing (`supabase/tests/19_billing_tenant_rls.sql`, paso `db-tests`) y los grants de `04_security_definer_and_grants.sql` deben seguir comprobando que el inquilino no lee columnas internas ni filas de otros salones. Las pruebas de integración `salon-subscriptions-tenant.rpc.test.ts` cubren `count_salon_usage` y `record_plan_alert`.
- Migración: `supabase/migrations/20240101000073_billing_tenant_rls.sql` (forward-only, sin cambios de datos).
