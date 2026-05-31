# Runbook: Platform Operations

## Objetivo

Operar acciones cross-tenant de Plataforma con trazabilidad y sin tocar datos
de Salon por accidente.

## Acciones Sensibles

| Accion | Control | Audit log |
|---|---|---|
| Invitar Salon | `requirePlatformAdmin` + use-case Platform | `invite_salon` |
| Suspender/reactivar Salon | `requirePlatformAdmin` + use-case Platform | `set_salon_status` |
| Activar/desactivar features | `requirePlatformAdmin` + constraint SQL | `update_salon_features` |
| Moderar feedback | `requirePlatformAdmin` | `set_feedback_status` |
| Eliminar Salon | Confirmacion exacta por ID + RPC | `delete_salon` |

## Antes De Eliminar Un Salon

1. Confirmar que el Salon correcto esta seleccionado.
2. Confirmar backup reciente si es production.
3. Copiar el ID desde Platform admin.
4. Escribir exactamente el ID en la confirmacion.
5. Despues de ejecutar, revisar logs y `platform_audit_log`.

## Antes De Suspender Un Salon

1. Confirmar que el Salon correcto esta seleccionado en `/admin/salons`.
2. Revisar si la suspension afecta citas activas o soporte en curso.
3. Ejecutar `Suspender`.
4. Confirmar que el badge queda como `Suspendido`.
5. Revisar `/admin/audit` para confirmar `set_salon_status`.

## Antes De Reactivar Un Salon

1. Confirmar que el Salon debe volver a operar.
2. Ejecutar `Reactivar`.
3. Confirmar que el badge queda como `Activo`.
4. Revisar `/admin/audit` para confirmar `set_salon_status`.

## Si Una Accion Falla

1. No repetir en bucle.
2. Revisar error en observabilidad/logs.
3. Revisar `platform_audit_log` para confirmar si la accion fue `failed`.
4. Si es borrado de Salon, revisar si el RPC borro datos pero fallo Auth cleanup.
5. Escalar antes de tocar SQL manual.

## Consulta Operativa

El audit log debe responder:

- quien ejecuto la accion;
- que accion fue;
- que Salon o recurso afecto;
- si tuvo exito o fallo;
- cuando ocurrio;
- detalle minimo no sensible.

## Revisar Auditoria

1. Entrar como Superadmin de Plataforma.
2. Abrir `/admin/audit`.
3. Filtrar por estado o accion.
4. Revisar fallos antes de repetir una operacion sensible.
5. Si una accion destructiva aparece como `Fallida`, revisar el detalle y logs
   antes de volver a ejecutarla.
