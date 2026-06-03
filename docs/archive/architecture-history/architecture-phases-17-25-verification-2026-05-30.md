# Verificacion De Fases 17-25

Fecha: 2026-05-30

Fuente verificada: `docs/architecture-audit-phases-2026-05-30.md`

## Resumen

Las fases 17-25 estan implementadas en estructura, documentacion y guardrails.
Durante esta verificacion se encontro una brecha en Fase 20: el RPC
`create_appointment` estaba probado, pero faltaba evidencia ejecutable para
no-overlap, tenant isolation basica y platform-only operations.

Se agregaron tests para cerrar esa brecha:

- `src/features/appointments/use-cases/create-appointment.rpc.test.ts`
  - rechaza reservas solapadas para el mismo colaborador;
  - rechaza cliente/servicio de otro tenant.
- `src/features/platform/data/salon-overviews.rpc.test.ts`
  - rechaza `platform_salon_overviews()` para usuarios de Salon autenticados;
  - permite `platform_salon_overviews()` desde service role.

Nota: la ejecucion de estos tests nuevos quedo pendiente porque el entorno
rechazo la ejecucion escalada por limite de uso. Los gates ejecutados antes de
agregar esos checks pasaron correctamente.

## Evidencia Ejecutada

Comandos ejecutados durante la verificacion:

```text
npm run type-check
OK

npm run lint
Architecture guardrails passed.

npm run build
OK

npm run architecture:health
architecture:check OK
unit tests OK
unit skipped: 0
E2E OK
E2E skipped: 0

git diff --check
OK, solo warnings de CRLF esperados en Windows

Supabase cleanup check
testSalons: 0
testAuthUsers: 0
```

## Fase 17 - Auth Admin En Adapters De Feature

Estado: verificada por inspeccion y guardrail.

Evidencia:

- Existe `src/features/employees/data/employee-auth.repo.ts`.
- Existe `src/features/platform/data/platform-auth.repo.ts`.
- `rg "@/lib/supabase/auth-admin" src/features -g "*use-cases*"` no encuentra
  usos productivos.
- `employee-invitations.ts`, `employee-access.ts` y `accept-invitation.ts`
  dependen de Adapters del feature.
- Tests de rollback/reutilizacion Auth existen en:
  - `src/features/employees/use-cases/employee-invitations.test.ts`
  - `src/features/employees/use-cases/employee-access.test.ts`
  - `src/features/platform/use-cases/accept-invitation.test.ts`

Conclusion: implementada correctamente.

## Fase 18 - Guardrails Privilegiados

Estado: verificada por inspeccion y `npm run lint`.

Evidencia:

- `scripts/check-architecture.mjs` define allowlist para:
  - `allowedAdminClientImporters`
  - `allowedAuthAdminImporters`
- Bloquea:
  - Auth Admin fuera de Adapters autorizados;
  - Supabase desde `src/components`;
  - `src/app -> features/*/data`;
  - tecnologia en `features/*/domain`.
- ADR 0010 documenta excepciones privilegiadas.
- `npm run lint` paso con `Architecture guardrails passed.`

Conclusion: implementada correctamente.

## Fase 19 - Indice De Docs Y Contratos Por Feature

Estado: verificada por existencia y contenido.

Evidencia:

- Existe `docs/README.md` y marca como vigentes:
  - auditoria 2026-05-30;
  - fases 2026-05-30;
  - contratos de base de datos;
  - testing;
  - E2E critico.
- Existen READMEs de Modules de alto riesgo:
  - `src/features/appointments/README.md`
  - `src/features/employees/README.md`
  - `src/features/platform/README.md`
  - `src/features/reports/README.md`
- Los READMEs incluyen responsabilidad, Interface, autoridad final, Adapters,
  tests y lo que no debe vivir ahi.

Conclusion: implementada correctamente.

## Fase 20 - Tests Skipped Y Checks RLS/RPC

Estado: implementacion reforzada durante esta verificacion; ejecucion final de
los tests nuevos pendiente por limite del entorno.

Evidencia existente:

- Existe `docs/testing.md`.
- `docs/database-contracts.md` referencia el flujo RPC/RLS.
- Existe `src/test/supabase-integration-fixtures.ts`.
- `create_appointment.rpc.test.ts` usa fixtures temporales con service role.
- `architecture:health` reporto:
  - skipped test files: 0;
  - skipped tests: 0.

Brecha encontrada:

- Faltaban checks ejecutables para:
  - no-overlap real en `appointment_items`;
  - tenant isolation basica en RPC;
  - platform-only operation para `platform_salon_overviews()`.

Correccion aplicada:

- Se agregaron tests RPC/RLS para esos contratos.

Pendiente de ejecucion cuando el entorno permita comandos:

```text
npm run test -- src/features/appointments/use-cases/create-appointment.rpc.test.ts src/features/platform/data/salon-overviews.rpc.test.ts
npm run test
npm run architecture:health
```

Conclusion: estructura y tests necesarios agregados; falta confirmar por
ejecucion porque el entorno rechazo el comando por limite de uso.

## Fase 21 - Ownership De Modules De Lectura

Estado: verificada por documentacion.

Evidencia:

- `src/features/dashboard/README.md` define dashboard como read Module de vista.
- `src/features/reports/README.md` define metricas y criterio para separar
  familias reales.
- `src/features/reminders/README.md` define recordatorios como cola operativa,
  no envio real.

Conclusion: implementada correctamente.

## Fase 22 - Higiene UI Route-Local

Estado: verificada por inventario y busquedas.

Evidencia:

- Existe `docs/ui-route-local-inventory-2026-05-30.md`.
- `rg "@/features/.*/data" src/app` no encuentra imports.
- `rg "@/lib/supabase" src/components` no encuentra imports.
- La decision de no mover UI por tamano conserva Locality y evita Seams
  superficiales.

Conclusion: implementada correctamente.

## Fase 23 - Auth Session

Estado: verificada por decision documentada.

Evidencia:

- Existe `docs/auth-session-review-2026-05-30.md`.
- La condicion para partir `session.ts` no esta activada.
- Se mantiene `src/lib/auth/session.ts` como fachada pequena.

Conclusion: implementada correctamente; no separar fue la decision correcta.

## Fase 24 - E2E Critico

Estado: verificada por documentacion, specs y `architecture:health`.

Evidencia:

- Existe `playwright.config.ts`.
- Existen scripts:
  - `npm run test:e2e`
  - `npm run test:e2e:ui`
- Existen specs:
  - `e2e/auth.spec.ts`
  - `e2e/salon-owner.spec.ts`
  - `e2e/platform-admin.spec.ts`
  - `e2e/feature-disabled.spec.ts`
- Cobertura presente:
  - login;
  - dashboard de Salon;
  - crear cita;
  - confirmar/completar/cancelar cita;
  - archivar/reactivar cliente;
  - generar invitacion de colaborador;
  - platform admin;
  - feature disabled oculta y denegada por ruta.
- `architecture:health` reporto E2E OK y skipped E2E tests: 0.

Conclusion: implementada correctamente.

## Fase 25 - Dashboard De Salud Arquitectonica

Estado: verificada por script y ejecucion.

Evidencia:

- Existe `scripts/architecture-health.mjs`.
- Existe script `npm run architecture:health`.
- El reporte muestra:
  - guardrail;
  - skipped tests;
  - skipped E2E;
  - imports privilegiados;
  - docs vigentes;
  - migraciones recientes;
  - estado aproximado de `database.types.ts`.

Observacion:

- El reporte informa que `database.types.ts` parece mas viejo que la ultima
  migracion por `mtime`. Es una alerta informativa, no una falla.

Conclusion: implementada correctamente.

## Veredicto

El plan de fases 17-25 esta implementado correctamente, con una salvedad
operativa: los tests nuevos agregados para cerrar completamente la Fase 20 deben
ejecutarse cuando el entorno vuelva a permitir comandos escalados.

No se detectaron regresiones de arquitectura en:

- Auth Admin desde use-cases;
- `src/app -> features/*/data`;
- Supabase desde `src/components`;
- carpetas vacias bajo `src/features`;
- skipped tests/E2E en el ultimo health report ejecutado.
