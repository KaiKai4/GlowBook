# Runbook: Incidents

## Objetivo

Responder rapido a incidentes durante piloto, crecimiento y lanzamiento amplio.

## Roles

- Owner de soporte: definido en `docs/launch-support.md`.
- Responsable tecnico: quien puede revisar Vercel, Supabase y deploys.
- Responsable de comunicacion: quien avisa a salones afectados.

## Severidad

| Severidad | Ejemplo | Accion |
|---|---|---|
| SEV1 | Sospecha de datos cruzados, login global caido, perdida de datos. | Pausar cambios, investigar, comunicar, activar rollback/restore si aplica. |
| SEV2 | Citas no se crean, Supabase lento, errores 500 en rutas criticas. | Investigar logs, aplicar workaround, decidir rollback. |
| SEV3 | Reporte lento, UI menor rota, feedback no critico. | Registrar, priorizar y resolver en siguiente ciclo. |

## Incidente: Sospecha De Datos Cruzados

1. Pausar deploys.
2. Registrar Salon, usuario, ruta y hora.
3. Revisar Vercel Logs y Supabase logs.
4. Revisar `platform_audit_log` si aplica.
5. Intentar reproducir con fixtures multi-tenant.
6. Si se confirma, tratar como SEV1.
7. Preparar comunicacion y postmortem.

## Incidente: Citas No Se Crean

1. Revisar errores en Vercel Logs.
2. Revisar Supabase RPC `create_appointment`.
3. Confirmar si afecta un Salon o todos.
4. Ejecutar E2E de cita en staging si hay tiempo.
5. Si empezo despues de deploy, evaluar rollback.

## Incidente: Supabase Lento

1. Revisar Supabase status/dashboard.
2. Revisar advisors/logs.
3. Revisar rutas lentas en Vercel.
4. Reducir acciones de alto costo si hay workaround.
5. Escalar plan/proveedor si los limites lo explican.

## Incidente: Salon Suspendido Por Error

1. Revisar `platform_audit_log`.
2. Confirmar actor y hora.
3. Reactivar desde Platform si corresponde.
4. Registrar decision con owner de soporte.
5. Revisar si falta confirmacion adicional en UI/runbook.

## Incidente: Reportes Lentos

1. Revisar dataset/tamano del Salon.
2. Revisar Vercel Function duration.
3. Revisar Supabase logs/advisors.
4. Si se repite, abrir performance review.

## Postmortem

Registrar:

```text
Fecha:
Severidad:
Salones afectados:
Impacto:
Inicio:
Deteccion:
Mitigacion:
Resolucion:
Causa raiz:
Acciones preventivas:
Owner:
```

