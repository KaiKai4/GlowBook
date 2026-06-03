# Auditoria De Arquitectura Y Readiness 5+ Salones - GlowBook

Fecha: 2026-06-01

Skill usada: `improve-codebase-architecture`

## Objetivo

Auditar GlowBook carpeta por carpeta para confirmar:

1. Que arquitectura se esta usando actualmente.
2. Que tan bien esta implementada como monolito modular.
3. Que falta para mantener orden suficiente.
4. Que falta para lanzar u operar con 5 salones o mas.

La auditoria usa el vocabulario de la skill:

- **Module**: unidad con Interface e Implementation.
- **Interface**: lo que el caller debe conocer para usar el Module: tipos,
  invariantes, errores, orden, configuracion y costos.
- **Implementation**: codigo interno del Module.
- **Depth**: cuanto comportamiento queda detras de una Interface pequena.
- **Seam**: punto donde vive una Interface y donde se puede cambiar
  comportamiento sin editar callers.
- **Adapter**: Implementation concreta en una Seam.
- **Leverage**: valor que obtiene quien llama una Interface profunda.
- **Locality**: concentracion de cambios, bugs, conocimiento y verificacion.

## Fuentes Revisadas

- `CONTEXT.md`
- `README.md`
- `docs/README.md`
- `docs/adr/*`
- `docs/database-contracts.md`
- `docs/production-readiness-checklist.md`
- `docs/release-readiness-2026-05-31.md`
- `docs/architecture-audit-phases-2026-05-31.md`
- `docs/runbooks/*`
- `src/app`
- `src/components`
- `src/features`
- `src/lib`
- `src/test`
- `src/types`
- `scripts`
- `e2e`
- `supabase`

## Evidencia Ejecutada

Estado de Git antes de crear esta auditoria: limpio.

Comandos verificados en el cierre de fases:

```text
npm run release:readiness
Summary: 21 ok, 0 blocked
Release decision: launch gate passed.

npm run ci:verify
lint OK
architecture guardrails OK
type-check OK
tests OK: 51 files, 144 tests
build OK

npm run test:e2e
13 passed

npm run architecture:health
Architecture Guardrail OK
Tests OK
E2E OK
Docs OK
Recent migrations OK
Database types current
```

Comando ejecutado durante esta auditoria:

```text
npm run architecture:check
Architecture guardrails passed.
```

Tambien se confirmo:

- `src/app` y `src/components` no importan `src/features/*/data` directamente.
- `src/features/*/domain` no importa Supabase, Next, React ni `server-only`.
- Los imports privilegiados de Supabase Admin/Auth Admin estan localizados en
  Adapters autorizados por ADR 0010.

## Veredicto Ejecutivo

GlowBook usa correctamente una arquitectura:

```text
Next.js App Router + monolito modular feature-first + Supabase como Adapter
de persistencia, Auth, RLS, RPC y seguridad.
```

La arquitectura real coincide con ADR 0009:

```text
src/app
  -> Interface de delivery: rutas, layouts, paginas, Server Actions y UI local

src/features/<domain>
  -> Modules de negocio, read Modules, domain rules, use-cases y data Adapters

src/lib
  -> infraestructura transversal: Supabase, auth, observability, utils, Result

supabase/migrations
  -> autoridad SQL/RLS/RPC/constraints/triggers
```

Flujo principal esperado:

```text
app -> features/use-cases -> features/domain + features/data -> lib/supabase -> Supabase
```

Conclusion:

**No recomiendo cambiar de arquitectura.** La estructura actual es adecuada
para un SaaS multi-tenant de salones y esta suficientemente madura para operar
un MVP con 5 salones o mas, siempre que se mantengan los gates antes de cada
release.

## Porcentaje De Madurez

Orden arquitectonico del monolito modular:

```text
96% - 98% listo
2% - 4% restante
```

Readiness tecnica para lanzar/operar con 5 salones o mas:

```text
93% - 96% listo
4% - 7% restante
```

Lo restante ya no es una gran reestructura. Es disciplina operativa recurrente:
validar release por release, revisar logs, confirmar backups, mantener secrets
separados y no romper los Seams ya definidos.

## Module Map Actual

```text
Platform
  -> src/app/(platform)
  -> src/features/platform
  -> platform_admins, salon_invitations, platform_audit_log

Salon
  -> src/app/(dashboard)/salon
  -> src/features/salon
  -> salons, salon_business_hours, disabled_features

Appointments
  -> src/app/(dashboard)/appointments
  -> src/features/appointments
  -> appointments, appointment_items, create_appointment RPC

Employees
  -> src/app/(dashboard)/employees
  -> src/features/employees
  -> employees, work_schedules, employee_invitations

Customers
  -> src/app/(dashboard)/customers
  -> src/features/customers
  -> customers

Services
  -> src/app/(dashboard)/services
  -> src/features/services
  -> service_categories, services, employee assignments

Access
  -> src/app/(dashboard)/roles
  -> src/features/access
  -> roles, permissions, role_permissions

Notifications
  -> src/app/(dashboard)/plantillas
  -> src/features/notifications
  -> notification_templates

Reports
  -> src/app/(dashboard)/reports
  -> src/features/reports
  -> read Module operativo

Dashboard
  -> src/app/(dashboard)/page.tsx
  -> src/features/dashboard
  -> read Module de inicio del Salon

Reminders
  -> src/app/(dashboard)/recordatorios
  -> src/features/reminders
  -> read Module operativo, sin envio automatico prometido

Feedback
  -> src/components/layout/feedback-bubble
  -> src/features/feedback
  -> feedback_reports
```

## Inventario Actual

Modules en `src/features`:

| Module | Archivos | Tests | Lectura |
|---|---:|---:|---|
| `access` | 11 | 2 | Correcto para RBAC dinamico. |
| `appointments` | 28 | 9 | Muy profundo; Module critico bien protegido. |
| `customers` | 11 | 4 | Bueno; lifecycle y duplicados testeados. |
| `dashboard` | 4 | 1 | Read Module pequeno y correcto. |
| `employees` | 19 | 6 | Fuerte; acceso/Auth/invitaciones localizadas. |
| `feedback` | 4 | 1 | Pequeno y suficiente. |
| `notifications` | 7 | 2 | Plantillas y placeholders separados de envio. |
| `platform` | 33 | 13 | Fuerte; operaciones privilegiadas auditables. |
| `reminders` | 4 | 1 | Correcto como read Module manual. |
| `reports` | 8 | 2 | Bueno; domain de periodos y metricas. |
| `salon` | 13 | 4 | Fuerte; shell, settings y feature flags. |
| `services` | 9 | 2 | Bueno; catalogo claro. |

Archivos grandes observados:

| Archivo | Lineas | Evaluacion |
|---|---:|---|
| `src/types/database.types.ts` | 1285 | Generado; normal. |
| `src/app/(dashboard)/salon/salon-settings.tsx` | 370 | UI route-local; vigilar reglas de negocio. |
| `src/app/(dashboard)/appointments/appointments-calendar.tsx` | 317 | UI route-local; aceptable. |
| `src/features/appointments/use-cases/create-appointment.rpc.test.ts` | 371 | Test de integracion largo; aceptable por riesgo. |
| `src/app/(dashboard)/services/services-manager.tsx` | 306 | UI route-local; aceptable. |
| `src/app/(dashboard)/recordatorios/reminders-view.tsx` | 279 | UI route-local; aceptable para MVP manual. |
| `src/app/(dashboard)/appointments/appointments-day-view.tsx` | 300 | UI route-local; aceptable. |
| `src/app/(dashboard)/reports/reports-view.tsx` | 265 | UI route-local; aceptable. |
| `src/features/appointments/data/appointment-commands.repo.ts` | 342 | Adapter critico; razonable por RPC/lifecycle. |

Lectura: los archivos grandes no rompen la arquitectura por si mismos. La
mayoria son UI de pantalla o tests de integracion. No hay senal actual de que
`src/app` este absorbiendo query shape o reglas de dominio.

## Auditoria Carpeta Por Carpeta

## Raiz Del Proyecto

Responsabilidad:

Definir producto, scripts, herramientas, configuracion y convenciones globales.

Estado:

Bueno.

Fortalezas:

- `CONTEXT.md` fija vocabulario de dominio.
- `package.json` tiene scripts claros: `ci:verify`, `architecture:check`,
  `architecture:health`, `release:readiness`, E2E y smoke.
- `next.config.ts` incluye headers base.
- `tsconfig.json`, `eslint.config.mjs`, `playwright.config.ts` y
  `vitest.config.ts` estan alineados con el stack.

Riesgos:

- `.next`, `node_modules`, `playwright-report` y `test-results` son generados;
  no deben entrar en decisiones arquitectonicas ni versionado.

Recomendacion:

- Mantener la raiz sin carpetas genericas nuevas tipo `services` o `shared`
  para negocio.

## `.github`

Responsabilidad:

Gates automatizados.

Estado:

Bueno.

Fortalezas:

- Job `quality` corre lint, architecture guardrails, type-check, tests y build.
- Job `e2e-and-health` corre E2E/health en `main` o manual si hay secrets.
- Usa `GLOWBOOK_ENV=staging` para el job de E2E.

Riesgos:

- E2E/health depende de secrets configurados en GitHub. Si faltan, el job lo
  salta con notice.

Recomendacion:

- Antes de cada release real, confirmar que el job E2E/health corrio con
  secrets staging y no fue omitido.

## `.agents`

Responsabilidad:

Tooling local de agentes.

Estado:

Neutro. No participa en runtime ni arquitectura de producto.

Recomendacion:

- No mezclarlo con decisiones de arquitectura de GlowBook.

## `docs`

Responsabilidad:

Arquitectura, ADRs, runbooks, readiness, contratos y evidencia.

Estado:

Bueno, aunque con bastante historial.

Fortalezas:

- `docs/README.md` marca documentos vigentes.
- `docs/database-contracts.md` conecta SQL/RLS/RPC con owners TypeScript.
- `docs/production-readiness-checklist.md` y
  `docs/release-readiness-2026-05-31.md` convierten readiness en gate.
- Runbooks cubren deploy, rollback, restore, migraciones, Platform operations y
  load smoke.

Riesgos:

- Hay varios documentos historicos de auditoria/fases. No son malos, pero si
  el indice no se mantiene, pueden volver a confundir.

Recomendacion:

- Mantener este documento como auditoria vigente y mover auditorias antiguas a
  estado "base anterior" o archivo si dejan de aportar.

## `docs/adr`

Responsabilidad:

Decisiones arquitectonicas load-bearing.

Estado:

Muy bueno.

ADRs criticos:

- ADR 0001: RLS multi-tenant.
- ADR 0002: `appointment_items` como fuente de verdad.
- ADR 0003: RBAC dinamico.
- ADR 0004: archivar/reactivar.
- ADR 0005: onboarding cerrado por invitacion.
- ADR 0006: delete Salon via RPC transaccional.
- ADR 0007: plantillas operativas.
- ADR 0008: tests como red de seguridad.
- ADR 0009: monolito modular feature-first.
- ADR 0010: excepciones server-only de admin Adapter.

Deletion test:

Si se borran estos ADRs, la complejidad vuelve como discusiones repetidas y
atajos inseguros. Deben conservarse.

## `e2e`

Responsabilidad:

Validar flujos criticos de navegador.

Estado:

Bueno para MVP 5+ salones.

Specs:

- `auth.spec.ts`
- `feature-disabled.spec.ts`
- `platform-admin.spec.ts`
- `salon-owner.spec.ts`

Evidencia:

- E2E directo paso con 13/13.
- `architecture:health` paso con E2E OK.

Riesgos:

- Si cambia auth, middleware, Platform o appointments, E2E debe correr contra
  staging antes de promover.

## `scripts`

Responsabilidad:

Guardrails, health report, release gate, bootstrap y smoke.

Estado:

Muy bueno.

Fortalezas:

- `check-architecture.mjs` bloquea reglas importantes.
- `release-readiness.mjs` convierte fases en gate ejecutable.
- Smoke de 5 salones exige confirmaciones explicitas.
- Scripts de staging tienen guards contra production.

Riesgos:

- `architecture:health` es report-only; no sustituye `ci:verify`.

Recomendacion:

- Mantener `ci:verify` como gate obligatorio y `architecture:health` como
  evidencia de release.

## `supabase`

Responsabilidad:

Schema, RLS, RPC, constraints, grants y configuracion local.

Estado:

Fuerte.

Fortalezas:

- Migraciones versionadas hasta
  `20240101000028_optimize_rls_policy_performance.sql`.
- RLS y helpers son autoridad de aislamiento.
- `create_appointment` protege cita itemizada.
- Constraints same-Salon reducen relaciones cruzadas.
- `delete_salon_completely` protege borrado transaccional de tenant.
- `platform_salon_overviews` mejora lectura de Platform.
- `platform_audit_log` registra acciones sensibles.
- `supabase/config.toml` usa puertos `554xx`, necesario en esta maquina Windows.

Evidencia:

- Restore staging -> local probado con Docker/Supabase local.
- Dump data-only de `auth,public` restaurado con `ON_ERROR_STOP=1`.
- Validacion: 5 salones, 500 clientes, 30 colaboradores, 400 citas y 5 auth users.
- Staging quedo limpio despues de cleanup.

Riesgos:

- Cualquier migracion nueva debe ir acompanada de `db:types`, tests y revision
  de `docs/database-contracts.md`.

## `src`

Responsabilidad:

Codigo de aplicacion.

Estado:

Bien organizado y alineado con ADR 0009.

Estructura:

```text
src/app
src/components
src/features
src/lib
src/test
src/types
```

No recomiendo agregar una capa global nueva.

## `src/app`

Responsabilidad:

Interface de delivery de Next.js.

Estado:

Bueno.

Fortalezas:

- `src/app` llama use-cases y read Modules.
- No se detectaron imports directos desde `src/app` a `features/*/data`.
- Server Actions son delivery Adapters: validan input, autorizan y llaman
  Modules.
- UI route-local se mantiene cerca de la pantalla.

Riesgos:

- Los archivos UI grandes pueden acumular reglas si no se vigilan:
  `salon-settings.tsx`, `appointments-calendar.tsx`, `services-manager.tsx`,
  `reminders-view.tsx`, `reports-view.tsx`.

Recomendacion:

- No extraer por tamano. Extraer solo si aparece reuse, regla de dominio,
  estado compartido o necesidad de test por Interface propia.

## `src/app/(auth)`

Responsabilidad:

Login, invitaciones de Salon e invitaciones de colaborador.

Estado:

Bueno.

Fortalezas:

- Delivery separado de use-cases.
- Alineado con onboarding cerrado por invitacion.

Riesgos:

- Es area sensible; mantener E2E y guards de entorno.

## `src/app/(dashboard)`

Responsabilidad:

Area operativa del Salon.

Estado:

Bueno.

Fortalezas:

- Cada ruta tiene Module correspondiente.
- `layout.tsx` usa `getDashboardShell`.
- Feature flags y permisos se respetan en navegacion y acceso directo.

Riesgos:

- Si dashboard/reports/reminders crecen, evitar que se conviertan en cajones de
  queries.

## `src/app/(platform)`

Responsabilidad:

Administracion global del SaaS.

Estado:

Fuerte.

Fortalezas:

- Usa Platform superadmin y Adapters privilegiados autorizados.
- Acciones de alto impacto registran audit log.
- Delete Salon queda detras de use-case + RPC.

Riesgos:

- Cualquier nuevo flujo cross-tenant debe actualizar ADR 0010 si usa
  `service_role`.

## `src/app/api`

Responsabilidad:

Route handlers tecnicos.

Estado:

Pequeno y correcto.

Recomendacion:

- Mantener route handlers como delivery Adapters, no como Modules de negocio.

## `src/components`

Responsabilidad:

UI compartida.

Estado:

Bueno.

## `src/components/ui`

Responsabilidad:

UI generica sin dominio.

Estado:

Correcto.

Riesgo:

- No mover UI de dominio aqui solo para reutilizar visualmente.

## `src/components/layout`

Responsabilidad:

Chrome compartido, navegacion, feedback bubble y estado visual global.

Estado:

Bueno con excepcion documentada.

Fortalezas:

- Puede importar dominio puro o tipos estables segun ADR 0009.
- No importa data Adapters ni Server Actions.

Riesgo:

- Si empieza a buscar datos, esa lectura debe vivir en `src/app` o un read
  Module.

## `src/features`

Responsabilidad:

Modules de negocio y read Modules.

Estado:

Muy bueno.

Regla observada:

```text
use-cases -> domain + data
domain -> sin framework / sin Supabase
data -> Supabase Adapter
```

## `src/features/access`

Responsabilidad:

Permisos, roles y asignacion de permisos.

Estado:

Bueno.

Fortalezas:

- RBAC dinamico se mantiene separado de UI.
- `domain/permissions.ts` estabiliza catalogo.

Riesgo:

- Catalogo SQL y TypeScript deben seguir sincronizados.

## `src/features/appointments`

Responsabilidad:

Citas, cita itemizada, disponibilidad, agenda y lifecycle.

Estado:

Muy fuerte.

Depth:

Alto. Este Module concentra reglas complejas detras de Interfaces pequenas:
crear cita, obtener calendario, disponibilidad, detalle y cambios de estado.

Deletion test:

Si se borra, la complejidad reaparece en paginas, Server Actions, reportes y
SQL. El Module gana su lugar.

Riesgo:

- Es el Module mas critico. Cambios deben tocar tests de domain/use-case y, si
  aplica, RPC/RLS.

## `src/features/customers`

Responsabilidad:

Clientes, duplicados, temporales, perfil y lifecycle.

Estado:

Bueno.

Riesgo:

- Si crecen reglas puras de duplicados o lifecycle, crear `domain/`; hoy no es
  necesario.

## `src/features/dashboard`

Responsabilidad:

Read Module de home del Salon.

Estado:

Correcto.

Riesgo:

- No convertirlo en bolsa de metricas. Si una metrica pertenece a reports,
  appointments o customers, moverla al owner.

## `src/features/employees`

Responsabilidad:

Colaboradores, horarios, asignaciones, acceso e invitaciones.

Estado:

Muy bueno.

Fortalezas:

- Auth Admin esta detras de Adapters autorizados.
- `domain/collaborator-assignment.ts` concentra reglas puras.
- Tiene buena cobertura de tests.

Riesgo:

- Toca `employee`, `profile`, `role`, Auth e invitaciones; requiere cuidado en
  cambios.

## `src/features/feedback`

Responsabilidad:

Enviar feedback y alimentar moderacion Platform.

Estado:

Bueno y pequeno.

Riesgo:

- Si crece a soporte real, necesitara nuevos use-cases y posiblemente un
  Module mas profundo.

## `src/features/notifications`

Responsabilidad:

Plantillas, placeholders y renderizado de mensajes.

Estado:

Bueno.

Fortaleza:

- No owns envio de recordatorios; eso evita mezclar responsabilidades.

## `src/features/platform`

Responsabilidad:

Invitaciones de Salon, overview cross-tenant, audit log, feedback moderation,
suspension/reactivacion y delete completo.

Estado:

Fuerte.

Depth:

Alto. Platform es profundo porque esconde operaciones privilegiadas, audit log y
RPC detras de use-cases con Interfaces pequenas.

Riesgo:

- Alto impacto. Nuevos usos de `service_role` requieren actualizar ADR 0010.

## `src/features/reminders`

Responsabilidad:

Read Module de cola operativa de recordatorios.

Estado:

Correcto para MVP manual.

Decision:

No se promete envio automatico. Si se promete despues, abrir nuevo Module de
envio con Adapter externo, retries y log de intentos.

## `src/features/reports`

Responsabilidad:

Reportes operativos del Salon.

Estado:

Bueno.

Fortalezas:

- `domain/period.ts` y `domain/metrics.ts` dan Depth real.
- Query shape esta en data Adapter.

Riesgo:

- Si crecen reportes, separar por familias reales, no por estetica.

## `src/features/salon`

Responsabilidad:

Configuracion, business hours, tema, feature flags y shell.

Estado:

Fuerte.

Riesgo:

- Es dependency de muchos Modules. Mantenerlo estable y profundo.

## `src/features/services`

Responsabilidad:

Catalogo de categorias y servicios.

Estado:

Bueno.

Riesgo:

- Si aparecen paquetes, reglas de precio o restricciones complejas, crear
  `domain/`.

## `src/lib`

Responsabilidad:

Infraestructura transversal.

Estado:

Bueno.

## `src/lib/auth`

Responsabilidad:

Session, Profile, Platform admin, permisos y feature flags.

Estado:

Bueno.

Riesgo:

- `session.ts` es sensible. No partirlo por tamano; partirlo solo si aparecen
  Seams reales.

## `src/lib/supabase`

Responsabilidad:

Adapters Supabase browser, server, admin y Auth Admin.

Estado:

Bueno.

Fortalezas:

- `admin.ts` usa `server-only`.
- `auth-admin.ts` esta detras de ADR 0010.
- Browser/server/admin estan separados.

## `src/lib/observability`

Responsabilidad:

Eventos y errores.

Estado:

Bueno para MVP.

Evidencia:

- Vercel Logs muestra requests reales `200`, redirects `307` esperados,
  Middleware/Function Invocation y sin secretos visibles.

Riesgo:

- Si se necesita retencion/alertas avanzadas, conectar webhook/log drain.

## `src/lib/utils`, `src/lib/validation`, `src/lib/result.ts`

Responsabilidad:

Helpers transversales pequenos.

Estado:

Correcto.

Riesgo:

- No convertir `utils` en cajon de dominio.

## `src/test`

Responsabilidad:

Fixtures y guards de integracion Supabase.

Estado:

Bueno.

Fortalezas:

- Bloquea production mediante entorno y `PRODUCTION_SUPABASE_URL`.
- Permite tests RPC/RLS cuando hay Supabase real.

## `src/types`

Responsabilidad:

Tipos compartidos y tipos generados de Supabase.

Estado:

Bueno.

Riesgo:

- `database.types.ts` debe regenerarse despues de migraciones.

## Evaluacion SOLID

## Single Responsibility Principle

Estado: bueno.

Responsabilidades separadas:

- `src/app`: delivery.
- `src/features`: negocio.
- `src/lib`: infraestructura.
- `supabase`: SQL/RLS/RPC.

## Open/Closed Principle

Estado: bueno.

Se pueden agregar use-cases y Adapters dentro de cada Module sin tocar toda la
app. Feature flags y permisos centralizados ayudan.

## Liskov Substitution Principle

Estado: bajo impacto.

No hay herencia compleja. El riesgo real vive en contratos de Adapters y
Results.

## Interface Segregation Principle

Estado: bueno.

No existe una Interface gigante tipo `SalonService`. Los use-cases son
Interfaces pequenas por accion.

## Dependency Inversion Principle

Estado: pragmatico y correcto.

No hay abstracciones artificiales para cada repo. Esto respeta la regla de la
skill: un Adapter = Seam hipotetica; dos Adapters = Seam real.

## Deepening Opportunities

## 1. Mantener Freshness De Readiness Por Release

Archivos:

- `docs/production-readiness-checklist.md`
- `docs/release-readiness-2026-05-31.md`
- `scripts/release-readiness.mjs`

Problema:

El gate esta cerrado ahora, pero readiness caduca. Un release futuro con
migraciones, auth o Platform necesita evidencia nueva.

Solucion:

Antes de cada release, ejecutar:

```text
npm run ci:verify
npm run test:e2e:staging
npm run release:readiness
```

Beneficio:

Locality operativa: la decision de lanzar vive en comandos y docs, no en
memoria.

Fuerza: Strong.

## 2. Log Drain O Error Tracking Si Crece Soporte

Archivos:

- `src/lib/observability/index.ts`
- `docs/security.md`
- `docs/runbooks/deploy.md`

Problema:

Vercel Logs basta para MVP, pero puede quedarse corto si hay soporte activo,
alertas o investigacion historica.

Solucion:

Conectar `GLOWBOOK_OBSERVABILITY_WEBHOOK_URL` a un proveedor/log drain y
mantener el cambio dentro de `src/lib/observability`.

Beneficio:

Aumenta Leverage sin tocar Modules de negocio.

Fuerza: Worth exploring.

## 3. Reminder Sending Module Solo Si Se Promete Envio Real

Archivos:

- `src/features/reminders`
- `src/features/notifications`
- `docs/reminders-launch-decision.md`

Problema:

Hoy recordatorios es flujo manual. Si se promete WhatsApp/SMS/email automatico,
faltan side effects, retries y log de intentos.

Solucion:

Crear use-cases:

- `send-reminder`
- `record-reminder-attempt`
- `retry-reminder`

Agregar Adapter de proveedor y usar `appointment_reminder_log`.

Beneficio:

Mantiene Locality del envio real y evita contaminar la vista de cola.

Fuerza: Condicional.

## 4. Cuidar UI Route-Local Grande

Archivos:

- `src/app/(dashboard)/salon/salon-settings.tsx`
- `src/app/(dashboard)/appointments/appointments-calendar.tsx`
- `src/app/(dashboard)/services/services-manager.tsx`
- `src/app/(dashboard)/recordatorios/reminders-view.tsx`
- `src/app/(dashboard)/reports/reports-view.tsx`

Problema:

Hoy son UI route-local aceptables. El riesgo aparece si se les agregan reglas,
query shape o estado reusable.

Solucion:

Aplicar deletion test en cada cambio:

- Si borrar el archivo solo mueve JSX, no extraer.
- Si borrar el archivo dispersa reglas de negocio, crear Module o helper local
  con Interface testeable.

Beneficio:

Evita extracciones cosmeticas y preserva Locality.

Fuerza: Worth exploring.

## 5. Higiene Documental Continua

Archivos:

- `docs/README.md`
- auditorias antiguas
- documentos de fases

Problema:

La documentacion es buena, pero hay bastante historial. Si no se marca vigencia,
puede confundir.

Solucion:

Mantener este documento como auditoria vigente y mover documentos reemplazados
a "base anterior" o archivo.

Beneficio:

Mejora AI-navigability y reduce deuda cognitiva.

Fuerza: Worth exploring.

## Que No Recomiendo Cambiar

- No migrar a microservicios.
- No crear una capa global `services`.
- No crear repositorios genericos por tabla.
- No extraer toda UI route-local de `src/app` solo por tamano.
- No partir `src/lib/auth/session.ts` sin Seam real.
- No crear Interfaces abstractas para Adapters unicos.
- No borrar ADRs vigentes.
- No prometer recordatorios automaticos si el producto sigue manual.

## Cuanto Falta Para Orden Suficiente

El sistema ya tiene orden suficiente.

Falta aproximada:

```text
2% - 4%
```

Trabajo restante:

1. Mantener el gate `architecture:check` en CI.
2. Mantener esta auditoria como vigente en `docs/README.md`.
3. Aplicar deletion test antes de extraer UI o crear Seams.
4. Actualizar ADR 0010 ante nuevos usos de `service_role`.
5. Regenerar tipos despues de migraciones.

Estimacion:

```text
0.5 - 1.5 dias de mantenimiento por ciclo grande de cambios
```

## Cuanto Falta Para Lanzar U Operar Con 5 Salones O Mas

Desde el punto de vista tecnico y de arquitectura:

```text
4% - 7% restante
```

El gate actual ya paso:

```text
21 OK / 0 bloqueados
```

Lo que queda no es bloqueo estructural; es operacion recurrente:

1. Confirmar secrets correctos en Vercel para el entorno que se va a lanzar.
2. Confirmar backup activo y politica de restore antes de datos reales.
3. Correr `npm run test:e2e:staging` antes de promover cambios grandes.
4. Revisar Vercel Logs y Supabase advisors despues de deploy/smoke.
5. Tener owner de soporte disponible la primera semana.
6. Conectar log drain/error tracking si el volumen de soporte lo exige.

Estimacion:

```text
1 - 3 dias si solo es preparar lanzamiento controlado con 5 salones.
3 - 5 dias si tambien se quiere log drain avanzado, alertas y proceso de soporte mas formal.
```

## Conclusion

GlowBook esta bien implementado como monolito modular. La separacion de
responsabilidades es clara, los Modules criticos tienen Depth, Supabase queda
detras de Adapters auditables y los gates actuales protegen contra regresiones.

No hay una reestructura grande pendiente. El trabajo importante ahora es
mantener la disciplina: gates por release, docs vigentes, ADRs para decisiones
load-bearing y no crear Seams hipoteticas sin presion real.

