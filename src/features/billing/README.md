# Billing

Módulo de planes comerciales, extras (addons), límites y módulos por salón, y pagos de plan. Reglas de acceso en `docs/database-contracts.md` (sección "Billing Tenant Contracts") y en ADR 0024.

## Responsabilidades

- `domain/`: funciones puras. Plan efectivo, ventanas de uso, estado de pago, alta de plan y claves de plan. Sin acceso a BD.
- `use-cases/`: orquestación por caso de uso (planes, addons, módulos del plan `plan-modules`, límites `plan-limits`, asignación, detalle de suscripción). Reciben el contexto por parámetro.
- `data/`: adaptadores Supabase finos, con `import "server-only"`. No toman decisiones de negocio.

## Interfaz pública

`index.ts` es el único punto de entrada para otros módulos: `getPlanCatalogSummary`, `autoAssignPlanOnAcceptance`, `checkPlanModuleAccess`, `getEffectiveSalonPlan`, `isEffectiveSalonModuleEnabled`, `checkPlanLimit`, `readEffectivePlanOrNull`, y los helpers de dominio `isActionableLimitWarning` y `evaluatePaymentStanding`.

## Qué cliente usa cada lectura o escritura

Los dos clientes se eligen en `data/billing-db.ts`.

| Operación | Cliente | Motivo |
|---|---|---|
| Plan efectivo del salón, módulos y límites del plan, overrides y asignación (columnas concedidas), alertas abiertas del salón | `billingSalonDb()` (sesión del usuario, RLS) | Datos del propio salón. La RLS es la autoridad (ADR 0024). |
| Conteo de uso (`count_salon_usage`) | `billingSalonDb()` o `billingDb()` | RPC `security definer` con guarda por `salon_id` de la sesión o plataforma. |
| Aviso de plan (`record_plan_alert`) | `billingSalonDb()` | RPC que crea la alerta solo en el salón de la sesión. |
| Panel `/admin`: suscripciones, detalle, extras, pagos, notas, alta y edición de planes | `platformDb(proof)` (`service_role`) | Columnas internas (motivo, notas, importes, regalos) y lecturas cross-tenant. `proof: PlatformAdminProof` es el primer parámetro, emitido solo por `requirePlatformAdminProof()` en el composition root (ADR 0028). |
| Escrituras de plataforma sobre un salón (asignar plan, overrides, pagos, alertas) | `platformDb(proof)` | Siempre filtradas por `salon_id`; deben afectar exactamente una fila (`expectOneUpdatedRow`). |

Las lecturas de plataforma no se hacen nunca desde el navegador.

`billingDb()` queda solo para el alta por invitación sin sesión de admin (`findPlanWithChildrenAtAcceptance`, `assignSalonPlanAtAcceptance`, ADR 0005 y ADR 0028).
