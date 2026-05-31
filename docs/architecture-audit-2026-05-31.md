# Auditoria De Arquitectura Y Readiness 5+ Salones - GlowBook

Fecha: 2026-05-31

Skill usada: `improve-codebase-architecture`

## Objetivo

Auditar GlowBook carpeta por carpeta para responder tres preguntas:

1. Que arquitectura se esta usando realmente.
2. Que tan bien esta implementada para un monolito modular.
3. Cuanto falta para tener orden suficiente y para lanzar con 5 salones o mas.

La auditoria usa el vocabulario de la skill:

- **Module**: unidad con Interface e Implementation.
- **Interface**: contrato que el caller debe conocer: tipos, invariantes,
  errores, orden, config y reglas de uso.
- **Implementation**: codigo interno del Module.
- **Depth**: cuanto comportamiento queda detras de una Interface pequena.
- **Seam**: punto donde vive una Interface y donde se puede cambiar
  comportamiento sin editar callers.
- **Adapter**: Implementation concreta en una Seam.
- **Leverage**: valor que obtiene quien llama una Interface profunda.
- **Locality**: valor para mantenimiento: cambio y conocimiento concentrados.

## Fuentes Revisadas

- `CONTEXT.md`
- `README.md`
- `docs/README.md`
- `docs/adr/0001-multi-tenant-rls.md`
- `docs/adr/0002-appointment-items-source-of-truth.md`
- `docs/adr/0003-dynamic-rbac-permissions.md`
- `docs/adr/0004-archive-reactivate-customers-collaborators.md`
- `docs/adr/0005-closed-onboarding-platform-invitations.md`
- `docs/adr/0006-delete-salon-through-transactional-rpc.md`
- `docs/adr/0007-notification-templates-operational-messages.md`
- `docs/adr/0008-tests-as-safety-net.md`
- `docs/adr/0009-modular-monolith-feature-architecture.md`
- `docs/adr/0010-server-only-admin-adapter-exceptions.md`
- `docs/database-contracts.md`
- `docs/production-readiness-checklist.md`
- `docs/architecture-production-readiness-phases-2026-05-30.md`
- `src/app`
- `src/components`
- `src/features`
- `src/lib`
- `src/test`
- `src/types`
- `scripts`
- `.github/workflows/ci.yml`
- `e2e`
- `supabase/migrations`

## Veredicto Ejecutivo

GlowBook usa una arquitectura **Next.js App Router + monolito modular
feature-first + Supabase como Adapter de persistencia, Auth y seguridad**.

La direccion real del codigo coincide con la direccion documentada:

```text
src/app
  -> Interface de delivery: rutas, paginas, layouts, Server Actions y UI local

src/features/<domain>
  -> Modules de negocio, read Modules, domain rules, use-cases y data Adapters

src/lib
  -> infraestructura transversal: auth, Supabase, observability, utils, Result

supabase/migrations
  -> autoridad SQL/RLS/RPC/constraints
```

Dependencia objetivo:

```text
app -> features/use-cases -> features/domain + features/data -> lib/supabase -> Supabase
```

Estado actual de orden arquitectonico:

```text
92% - 94% listo
6% - 8% restante
```

Estado actual para lanzar con 5 salones o mas:

```text
82% - 88% listo en repositorio
75% - 82% listo si faltan evidencias externas de staging, restore y smoke
```

Mi conclusion: **no hace falta cambiar de arquitectura**. El sistema ya va por
el camino correcto para un monolito modular. El siguiente trabajo no es
reescribir, sino cerrar evidencia operativa: staging real, E2E contra deploy,
restore probado, smoke con 5 salones y observabilidad conectada a un proveedor
real si se va a operar produccion.

## Arquitectura Actual

## Tipo De Arquitectura

GlowBook esta implementado como **monolito modular feature-first**.

Esto significa:

- un solo deploy;
- una sola aplicacion Next.js;
- dominio separado por Modules bajo `src/features`;
- Supabase como Adapter de datos y seguridad;
- SQL/RLS/RPC como autoridad final para aislamiento multi-tenant;
- Server Actions como delivery Adapters, no como lugar principal de reglas.

Esta decision es correcta para el estado del producto. Un SaaS de salones con 5
a 20 salones iniciales necesita Locality, tests y seguridad antes que
microservicios.

## Module Map

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
  -> read Module sobre appointments, customers e items

Dashboard
  -> src/app/(dashboard)/page.tsx
  -> src/features/dashboard
  -> read Module de inicio del Salon

Reminders
  -> src/app/(dashboard)/recordatorios
  -> src/features/reminders
  -> read Module operativo, sin envio real todavia

Feedback
  -> src/components/layout/feedback-bubble
  -> src/features/feedback
  -> feedback_reports
```

## Decisiones Arquitectonicas Que Estan Bien Protegidas

- RLS es la autoridad final de aislamiento multi-tenant.
- `appointment_items` es la fuente de verdad de agenda.
- RBAC se basa en permisos, no en nombres de rol.
- Cliente y colaborador se archivan/reactivan; no se borran por flujo normal.
- Onboarding de Salon es cerrado por invitacion de Plataforma.
- Eliminacion completa de Salon es excepcion transaccional protegida.
- `service_role` esta detras de Adapters server-only autorizados.
- Tests y guardrails forman parte de la arquitectura, no son extra opcional.

## Inventario General

Conteo observado:

```text
docs        32 archivos
e2e          4 archivos
scripts      6 archivos
src        267 archivos
supabase    39 archivos
```

Modules en `src/features`:

```text
access          11 archivos,  2 tests, domain/data/use-cases
appointments    28 archivos,  9 tests, domain/data/use-cases
customers       11 archivos,  4 tests, data/use-cases
dashboard        4 archivos,  1 test, data/use-cases
employees       19 archivos,  6 tests, domain/data/use-cases
feedback         4 archivos,  1 test, data/use-cases
notifications    7 archivos,  2 tests, domain/data/use-cases
platform        33 archivos, 13 tests, data/use-cases
reminders        4 archivos,  1 test, use-cases
reports          8 archivos,  2 tests, domain/data/use-cases
salon           13 archivos,  4 tests, domain/data/use-cases
services         9 archivos,  2 tests, data/use-cases
```

Lectura: los Modules criticos tienen buena Locality. No se observan carpetas
vacias creadas solo por apariencia.

## Auditoria Carpeta Por Carpeta

## Raiz Del Proyecto

Responsabilidad:

Definir el producto, scripts, herramientas y convenciones globales.

Estado:

Bueno. La raiz esta relativamente limpia y contiene archivos esperados:

- `README.md`
- `CONTEXT.md`
- `AGENTS.md`
- `CLAUDE.md`
- `package.json`
- `tsconfig.json`
- `eslint.config.mjs`
- `next.config.ts`
- `playwright.config.ts`
- `vitest.config.ts`
- `.env.local.example`

Fortalezas:

- `README.md` describe arquitectura y reglas de import.
- `CONTEXT.md` estabiliza vocabulario de dominio.
- `package.json` tiene scripts claros para dev, CI, tests, E2E, Supabase y
  smoke de 5 salones.
- `next.config.ts` ya tiene headers base de seguridad.
- `.env.local.example` documenta variables server-only y guards de entorno.

Riesgos:

- `.next`, `node_modules`, `playwright-report`, `test-results` y
  `tsconfig.tsbuildinfo` son generados. Son normales localmente, pero no deben
  influir en auditorias ni entrar a versionado.

Evaluacion:

Correcto. No recomiendo crear mas archivos globales ni una carpeta generica
`services`.

## `.github`

Responsabilidad:

Automatizar gates de calidad.

Estado:

Bueno. Existe `.github/workflows/ci.yml` con:

- `npm ci`
- `npm run lint`
- `npm run type-check`
- `npm run test`
- `npm run build`
- E2E/health en `main` o `workflow_dispatch` cuando existan secrets staging.

Fortalezas:

- `npm run lint` incluye `scripts/check-architecture.mjs`.
- CI separa gates obligatorios de PR y gates dependientes de staging.

Riesgos:

- E2E/health de staging depende de secrets externos. Si no se configuran, el
  repo esta listo, pero la operacion no queda validada.

Mejora recomendada:

- Antes de produccion, capturar evidencia de una corrida real del job
  `E2E And Architecture Health`.

## `.agents`

Responsabilidad:

Skills/instrucciones de agente del workspace.

Estado:

Neutro. No forma parte del runtime de GlowBook.

Riesgos:

- Puede confundir si se mezcla con arquitectura de producto. Debe tratarse como
  tooling local.

## `docs`

Responsabilidad:

Registrar arquitectura, contratos, runbooks, readiness y decisiones vigentes.

Estado:

Bueno y mucho mas limpio despues de retirar auditorias reemplazadas.

Fortalezas:

- `docs/README.md` marca documentos vigentes.
- `docs/database-contracts.md` conecta SQL/RLS/RPC con owners TypeScript.
- `docs/production-readiness-checklist.md` convierte lanzamiento en checklist.
- Runbooks cubren deploy, rollback, restore, migraciones, Platform operations y
  load smoke.
- La documentacion ahora reduce deuda de memoria individual.

Riesgos:

- Si se crean auditorias nuevas sin actualizar `docs/README.md`, volvera la
  confusion entre documento actual y documento reemplazado.

Mejora recomendada:

- Mantener un solo documento marcado como auditoria vigente.
- Convertir esta auditoria en fases solo si se van a ejecutar cambios.

## `docs/adr`

Responsabilidad:

Registrar decisiones arquitectonicas estables.

Estado:

Muy bueno. Los ADR actuales son load-bearing y no deben borrarse.

ADRs clave:

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

Si se borran estos ADR, la complejidad vuelve a aparecer como discusiones
repetidas en PRs y refactors. Se deben conservar.

## `e2e`

Responsabilidad:

Validar flujos criticos desde el navegador.

Estado:

Bueno para MVP y staging inicial.

Specs:

- `auth.spec.ts`
- `feature-disabled.spec.ts`
- `platform-admin.spec.ts`
- `salon-owner.spec.ts`

Fortalezas:

- Cubre login/auth, Platform, owner y feature flags.
- Puede correr local con dev server o contra staging via `E2E_BASE_URL`.
- Los `test.skip` observados son guards por entorno/fixture, no skips
  silenciosos de deuda si `architecture:health` reporta cero skips reales en la
  corrida.

Riesgos:

- Para produccion, los E2E utiles son los que corren contra deploy staging real,
  no solo contra dev server.

Mejora recomendada:

- Ejecutar `npm run test:e2e:staging` antes del lanzamiento y guardar evidencia.

## `scripts`

Responsabilidad:

Guardrails, health report, bootstrap y datos de staging/smoke.

Estado:

Muy bueno.

Scripts clave:

- `check-architecture.mjs`
- `architecture-health.mjs`
- `bootstrap-platform-admin.mjs`
- `require-staging-e2e-env.mjs`
- `seed-staging-smoke.mjs`
- `cleanup-staging-smoke.mjs`

Fortalezas:

- `check-architecture.mjs` bloquea imports peligrosos:
  - `components -> app`;
  - `features/*/domain -> Supabase/Next/React`;
  - `app -> features/*/data`;
  - `service_role` fuera de Adapters autorizados.
- Smoke de 5 salones exige `GLOWBOOK_ENV=staging` y confirmaciones explicitas.
- Cleanup usa flujo protegido para eliminar Salones seed.

Riesgos:

- `architecture-health.mjs` es report-only. No falla el build por si mismo.
  Esta bien como dashboard, pero no sustituye `ci:verify`.

Mejora recomendada:

- Mantener `architecture:check` como gate obligatorio.
- Usar `architecture:health` como evidencia antes de release.

## `supabase`

Responsabilidad:

Fuente de verdad de schema, RLS, RPCs, triggers, constraints y funciones.

Estado:

Fuerte para la etapa actual.

Fortalezas:

- Migraciones ordenadas desde `20240101000000_initial_schema.sql`.
- RLS y helpers (`salon_id`, `has_permission`, `is_platform_admin`) existen como
  contrato central.
- `create_appointment` concentra creacion atomica de cita.
- Constraints same-Salon reducen riesgo de relaciones cruzadas.
- `delete_salon_completely` mantiene borrado publico de tenant como RPC
  transaccional.
- `platform_salon_overviews` evita N+1 de Plataforma.
- `platform_audit_log` registra acciones de alto impacto.

Riesgos:

- Produccion necesita evidencia externa: migraciones aplicadas en staging,
  backup reciente, restore probado y smoke de 5 salones.

Mejora recomendada:

- Antes del primer lanzamiento, ejecutar runbook de migraciones y restore en
  staging/entorno temporal.

## `src`

Responsabilidad:

Codigo de aplicacion.

Estado:

Bien organizado. La separacion `app/components/features/lib/test/types` esta
alineada con ADR 0009.

Riesgos:

- Algunos archivos route-local de `src/app` son grandes. Esto es aceptable si
  son UI de pantalla, pero hay que evitar que absorban reglas de negocio.

## `src/app`

Responsabilidad:

Interface de delivery de Next.js:

- rutas;
- layouts;
- paginas;
- Server Actions;
- UI route-local.

Estado:

Bueno. No se detecto import directo desde `src/app` hacia
`src/features/*/data`. Las rutas consumen use-cases, schemas, domain helpers o
view-models.

Fortalezas:

- Server Actions de Platform son delgadas y llaman use-cases.
- Server Actions de appointments validan input, permisos y revalidan rutas.
- Paginas principales consumen read Modules (`dashboard`, `reports`,
  `reminders`, `platform`).
- UI route-local vive cerca de la ruta cuando no hay reutilizacion clara.

Riesgos:

- `src/app/(dashboard)/salon/salon-settings.tsx`
- `src/app/(dashboard)/appointments/appointments-calendar.tsx`
- `src/app/(dashboard)/services/services-manager.tsx`
- `src/app/(dashboard)/recordatorios/reminders-view.tsx`
- `src/app/(dashboard)/reports/reports-view.tsx`

Estos archivos son grandes. No son deuda por existir; son deuda solo si empiezan
a tener reglas de negocio, query shape o estado reusable fuera de la pantalla.

Hallazgo menor:

- `src/app/(dashboard)/recordatorios/page.tsx` contiene texto visible con
  mojibake en la frase de descripcion de recordatorios. Es UI copy, no
  arquitectura, pero conviene corregirlo.

Mejora recomendada:

- Mantener UI local en `src/app` mientras sea especifica de una ruta.
- Extraer a un Module solo cuando haya reuse real, tests necesarios o reglas
  que deban tener Locality fuera de la vista.

## `src/app/(auth)`

Responsabilidad:

Login, invitacion de Salon e invitacion de colaborador.

Estado:

Bueno.

Fortalezas:

- Usa Supabase browser client solo en flujos de Auth que necesitan navegador.
- Aceptacion de invitacion vive en `features/platform` o `features/employees`.

Riesgos:

- Onboarding es sensible. Debe mantenerse cubierto por E2E/staging y audit log
  cuando aplique.

## `src/app/(dashboard)`

Responsabilidad:

Area operativa del Salon.

Estado:

Bueno.

Fortalezas:

- Cada ruta corresponde a un Module de dominio o read Module.
- `layout.tsx` consume `getDashboardShell`, no arma query shape local.
- Feature flags del Salon se respetan en navegacion y permisos.

Riesgos:

- La home del dashboard compone bastante UI. Hoy es razonable porque
  `features/dashboard` concentra las lecturas.

## `src/app/(platform)`

Responsabilidad:

Administracion global de SaaS.

Estado:

Bueno.

Fortalezas:

- Usa `requirePlatformAdmin`.
- Acciones de alto impacto pasan `actorUserId`.
- Invitar, suspender/reactivar, cambiar funciones, borrar Salon y moderar
  feedback viven detras de use-cases.
- `/admin/audit` existe para revisar trazabilidad.

Riesgos:

- Platform usa `service_role` por naturaleza. ADR 0010 y guardrails lo
  controlan bien, pero cualquier nuevo flujo cross-tenant debe pasar por ADR o
  actualizar la lista permitida.

## `src/app/api`

Responsabilidad:

Route handlers tecnicos.

Estado:

Pequeno y correcto. `api/auth/signout` usa Supabase server Adapter.

Riesgos:

- Si crecen route handlers, no deben convertirse en un segundo sistema de
  use-cases. Mantener la regla: route handler = delivery Adapter.

## `src/components`

Responsabilidad:

UI compartida.

Estado:

Bueno.

## `src/components/ui`

Responsabilidad:

Atoms domain-free.

Estado:

Correcto. Contiene `button`, `card`, `dialog`, `input`, `select`,
`textarea`, `badge`.

Fortalezas:

- No se observaron imports hacia `src/app`.
- Mantiene UI base separada de reglas de dominio.

Riesgos:

- Si se agregan componentes de dominio aqui, se perderia Locality. Mantener UI
  generica solamente.

## `src/components/layout`

Responsabilidad:

Chrome compartido, navegacion, feedback bubble y guard de cambios sin guardar.

Estado:

Bueno con excepcion documentada.

Fortalezas:

- `nav-items.ts` importa tipos y dominio puro de `features/salon`, lo cual esta
  permitido por ADR 0009.
- No importa data Adapters ni Server Actions.
- `feedback-bubble` recibe la accion como prop y no conoce persistencia.

Riesgos:

- Si layout empieza a buscar datos por su cuenta, debe moverse la lectura a
  `src/app` o a un read Module.

## `src/features`

Responsabilidad:

Modules de negocio y read Modules.

Estado:

Muy bueno para un monolito modular. La mayor parte del valor arquitectonico esta
aqui.

Regla que se cumple:

```text
feature/use-cases -> feature/domain + feature/data
```

No se observaron `domain` Modules importando Supabase, Next o React.

## `src/features/access`

Responsabilidad:

Permisos, roles y asignacion de permisos dentro del Salon.

Estado:

Bueno.

Interface:

- `use-cases/get-roles-page.ts`
- `use-cases/create-role.ts`
- `use-cases/delete-role.ts`
- `use-cases/assign-role.ts`
- `use-cases/update-role-permissions.ts`

Fortalezas:

- `domain/permissions.ts` mantiene catalogo de permisos.
- Tests de roles protegen comportamiento.
- Alineado con ADR 0003.

Riesgos:

- El catalogo de permisos existe en SQL y TypeScript. Esta duplicacion es
  aceptable si se mantiene sincronizada.

## `src/features/appointments`

Responsabilidad:

Agenda, disponibilidad, lifecycle y creacion atomica de Cita.

Estado:

Muy fuerte. Es uno de los Modules con mas Depth.

Interface:

- `create-appointment`
- `get-calendar-view`
- `get-appointment-detail`
- `appointment-availability`
- `cancel-appointment`
- `confirm-appointment`
- `complete-appointment`

Fortalezas:

- `domain` concentra availability, scheduling, lifecycle, calendar y wizard
  availability.
- `data` separa lecturas de comandos/RPC.
- Tests cubren dominio, use-cases y RPC cuando hay entorno Supabase.
- SQL sigue siendo autoridad final.

Riesgos:

- Es el Module mas sensible del producto. Cualquier cambio en agenda debe tocar
  tests de domain/use-case y, si aplica, tests RPC/RLS.

Deletion test:

Si se borra `features/appointments`, la complejidad se dispersa por paginas,
acciones, Supabase y reportes. El Module gana su lugar.

## `src/features/customers`

Responsabilidad:

Clientes, duplicados, temporales, perfil y lifecycle.

Estado:

Bueno.

Fortalezas:

- Use-cases separados por comportamiento real.
- Tests cubren duplicados, temporales, lifecycle y pagina.
- `data/customers.repo.ts` concentra query shape.

Riesgos:

- No tiene `domain/`. Eso esta bien por ahora: no crear carpetas por estetica.
  Si crecen reglas puras de duplicados o lifecycle, ahi si conviene extraer.

## `src/features/dashboard`

Responsabilidad:

Read Module para la home del Salon.

Estado:

Correcto.

Fortalezas:

- Evita queries en `src/app/(dashboard)/page.tsx`.
- Tiene README y test de use-case.

Riesgos:

- Puede convertirse en cajon de metricas. Si una metrica se reutiliza en
  reports o Platform, debe moverse al Module owner correspondiente.

## `src/features/employees`

Responsabilidad:

Colaboradores, horarios, asignaciones, acceso e invitaciones.

Estado:

Muy bueno.

Fortalezas:

- `domain/collaborator-assignment.ts` protege reglas puras.
- `employee-auth.repo.ts` y `employee-access.repo.ts` encapsulan Auth Admin y
  service role segun ADR 0010.
- Tests cubren acceso, invitaciones, lifecycle, detail y listado.

Riesgos:

- Es sensible por enlazar `employee`, `profile`, `role`, Auth e invitaciones.
  Mantener el README y ADR 0010 como carga obligatoria antes de tocarlo.

## `src/features/feedback`

Responsabilidad:

Enviar feedback desde Salon y alimentar moderacion Platform.

Estado:

Bueno y pequeno.

Fortalezas:

- Interface simple.
- Feedback bubble no conoce persistencia.

Riesgos:

- Si feedback crece hacia conversaciones, adjuntos o workflow de soporte,
  necesitara mas Depth y probablemente nuevos use-cases.

## `src/features/notifications`

Responsabilidad:

Plantillas, placeholders y renderizado de mensajes operativos.

Estado:

Bueno.

Fortalezas:

- `domain/templates.ts` separa reglas puras.
- `notifications` no envia recordatorios; eso preserva la responsabilidad.
- Alineado con ADR 0007.

Riesgos:

- Si se implementa envio real, no meter proveedor externo aqui sin pensar: el
  owner operativo del flujo es `reminders`.

## `src/features/platform`

Responsabilidad:

Administracion global: invitaciones de Salon, overview cross-tenant, audit log,
moderacion, suspension/reactivacion y delete completo.

Estado:

Fuerte y muy bien testeado.

Fortalezas:

- 33 archivos y 13 tests: buen nivel de proteccion.
- Adapters privilegiados estan localizados.
- Audit log ya existe.
- `platform_salon_overviews` reduce carga de overview.
- Delete Salon combina RPC transaccional y cleanup Auth.

Riesgos:

- Alto impacto operativo. Cualquier nuevo Adapter con `service_role` debe
  actualizar ADR 0010.
- En produccion, Platform necesita runbook y evidencia de audit log real.

## `src/features/reminders`

Responsabilidad:

Read Module para cola operativa de recordatorios.

Estado:

Correcto para MVP si no se promete envio real.

Fortalezas:

- No finge tener `data` propio si no posee persistencia o proveedor externo.
- Usa otros data Adapters desde su use-case para componer vista operativa.
- Tiene README con condicion clara para envio real.

Riesgos:

- Si el producto promete WhatsApp/SMS/email real, esto deja de ser suficiente.
  Se necesita un Module de envio con Adapter externo, logs de intentos y
  retries.

## `src/features/reports`

Responsabilidad:

Reportes operativos del Salon.

Estado:

Bueno.

Fortalezas:

- `domain/period.ts` y `domain/metrics.ts` dan Depth real.
- `data/reports.repo.ts` concentra rows de lectura.
- Page consume use-case, no repos.

Riesgos:

- Si crecen reportes, separar por familias reales: revenue, asistencia,
  colaboradores, servicios y capacidad. No separar por estetica.

## `src/features/salon`

Responsabilidad:

Configuracion del Salon, business hours, tema y feature flags.

Estado:

Bueno.

Fortalezas:

- `domain/salon-features.ts` estabiliza feature flags.
- `get-dashboard-shell` evita que layout arme sus propias lecturas.
- Tests cubren settings, shell, features y business hours.

Riesgos:

- `features/salon` es dependency de muchos Modules. Debe mantenerse profundo y
  estable, no convertirse en bolsa de utilidades.

## `src/features/services`

Responsabilidad:

Catalogo de categorias y servicios.

Estado:

Bueno.

Fortalezas:

- Use-cases claros: catalogo, crear categoria, crear/actualizar servicio.
- Data Adapter concentra query shape.
- Tests de catalogo.

Riesgos:

- No tiene `domain/`, y eso esta bien. Si aparecen reglas complejas de precio,
  duracion, paquetes o disponibilidad por servicio, entonces si conviene crear
  domain.

## `src/lib`

Responsabilidad:

Infraestructura transversal.

Estado:

Bueno.

## `src/lib/auth`

Responsabilidad:

Session, Profile, Platform admin, permisos y feature flags.

Estado:

Bueno con una excepcion intencional.

Fortalezas:

- `permissions.ts` implementa RBAC dinamico y respeta funciones deshabilitadas.
- `session.ts` centraliza Profile y Platform admin.
- `session.ts` usa admin Adapter para Platform admin detection, permitido por
  ADR 0010.

Riesgos:

- `session.ts` es un Module muy sensible. No partirlo solo por tamano; partirlo
  solo si aparecen dos o mas Seams reales: Profile session, Platform admin,
  Salon active guard, etc.

## `src/lib/supabase`

Responsabilidad:

Adapters de Supabase:

- browser anon client;
- server session client;
- server-only admin client;
- Auth Admin helper.

Estado:

Bueno.

Fortalezas:

- `admin.ts` importa `server-only`.
- `auth-admin.ts` esta restringido por ADR 0010 y guardrail.
- Browser y server clients estan separados.

Riesgos:

- La llave `service_role` sigue siendo el punto mas sensible. La arquitectura lo
  controla bien, pero operacion debe cuidar secrets y logs.

## `src/lib/observability`

Responsabilidad:

Adapter transversal de eventos y errores.

Estado:

Bueno como base inicial.

Fortalezas:

- Interface minima: `captureError`, `logEvent`.
- Sanitiza metadata por nombre sensible.
- No acopla dominio a proveedor externo.

Riesgos:

- Hoy emite a consola. Para produccion real, se necesita conectar hosting,
  error tracking o log drain y definir alertas.

## `src/lib/utils` y `src/lib/validation`

Responsabilidad:

Helpers pequenos compartidos.

Estado:

Bueno.

Fortalezas:

- Tests para fechas y telefono.
- `validation/name.ts` evita duplicacion.

Riesgos:

- No convertir `utils` en cajon. Si una regla pertenece a Salon, Cita o Cliente,
  debe vivir en su Module.

## `src/lib/result.ts`

Responsabilidad:

Patron comun de errores retornables.

Estado:

Correcto.

Deletion test:

Aunque es pequeno, si se borra, cada use-case inventaria su propio contrato de
errores. Mantenerlo da consistencia.

## `src/test`

Responsabilidad:

Fixtures e integracion Supabase para tests.

Estado:

Bueno.

Fortalezas:

- Fixtures bloquean production mediante `GLOWBOOK_ENV` y
  `PRODUCTION_SUPABASE_URL`.
- Tests RPC/RLS se pueden activar cuando hay Supabase real.

Riesgos:

- Las pruebas de seguridad dependen de entorno. Antes de produccion hay que
  ejecutarlas contra staging.

## `src/types`

Responsabilidad:

Tipos compartidos y tipos generados de Supabase.

Estado:

Bueno.

Fortalezas:

- `database.types.ts` es contrato generado, no editado manualmente.
- `app.types.ts` centraliza tipos de aplicacion.

Riesgos:

- Cada migracion que cambie schema/RPC/enum debe regenerar tipos.

## Evaluacion SOLID

## Single Responsibility Principle

Estado: bueno.

La responsabilidad principal esta bien repartida:

- `src/app`: delivery.
- `src/features`: negocio.
- `src/lib`: infraestructura.
- `supabase/migrations`: autoridad SQL.

Riesgo menor: algunos archivos UI route-local grandes pueden acumular demasiada
responsabilidad si se les agrega logica no visual.

## Open/Closed Principle

Estado: bueno.

El sistema permite agregar use-cases, domain rules o data Adapters dentro del
Module sin tocar toda la app. Feature flags del Salon y permisos estan
centralizados.

Riesgo: nuevos features deben seguir el patron; crear shortcuts en `src/app`
romperia esto.

## Liskov Substitution Principle

Estado: bajo impacto.

No hay jerarquias complejas. El principio aplica mas a Adapters y contratos de
Result que a herencia.

## Interface Segregation Principle

Estado: bueno.

Los use-cases son Interfaces pequenas por accion. No hay una Interface global
tipo `SalonService` o `Repository` gigante.

Riesgo: read Modules como dashboard/reports/reminders deben evitar crecer como
Interfaces enormes.

## Dependency Inversion Principle

Estado: pragmatico y correcto.

El proyecto no crea abstracciones artificiales para cada repo. Esto es bueno:
segun la skill, **un Adapter = Seam hipotetica; dos Adapters = Seam real**.

Donde si hay presion real:

- Supabase admin Adapter;
- Auth Admin Adapter;
- observability Adapter;
- external reminder provider futuro.

## Guardrails Y Tests

Estado:

Muy bueno para arquitectura.

Gates disponibles:

```text
npm run lint
npm run architecture:check
npm run type-check
npm run test
npm run build
npm run ci:verify
npm run test:e2e
npm run test:e2e:staging
npm run architecture:health
```

Lo que protegen:

- imports prohibidos;
- pureza de `features/*/domain`;
- `service_role` detras de Adapters autorizados;
- uso de use-cases desde `src/app`;
- tests unitarios y de domain;
- E2E critico.

Riesgo:

- `architecture:health` reporta, pero no falla por documentos faltantes o
  findings informativos. Esta bien como dashboard; no sustituye CI.

## Seguridad Y Supabase

Estado:

Fuerte a nivel repo.

Fortalezas:

- RLS es autoridad.
- `service_role` esta limitado.
- Headers base en Next.
- Guards de entorno para staging/smoke.
- `PRODUCTION_SUPABASE_URL` evita fixtures contra produccion.
- Audit log de Plataforma.

Pendientes externos antes de produccion:

- secrets reales separados por entorno;
- E2E contra deploy staging;
- restore probado;
- smoke de 5 salones;
- revisar logs Supabase por queries lentas;
- confirmar headers en hosting real;
- definir rate limiting operativo si hay abuso o endpoints sensibles publicos.

## Deepening Opportunities

## 1. Evidencia Operativa De Staging

Archivos:

- `.github/workflows/ci.yml`
- `scripts/require-staging-e2e-env.mjs`
- `docs/environments.md`
- `docs/production-readiness-checklist.md`
- `docs/runbooks/deploy.md`

Problema:

El repo esta preparado, pero produccion exige evidencia externa: staging real,
secrets, deploy, E2E y health sobre ese deploy.

Solucion:

Ejecutar el flujo staging completo y guardar evidencia en checklist:

- URL staging;
- Supabase staging;
- `npm run test:e2e:staging`;
- `npm run architecture:health`;
- resultado CI;
- persona responsable.

Beneficio:

Mas Locality operativa: el conocimiento de "esta listo" deja de vivir en la
memoria y pasa a checklist/runbook.

Fuerza: Strong.

## 2. Restore Probado

Archivos:

- `docs/runbooks/database-restore.md`
- `docs/runbooks/database-migrations.md`
- `docs/production-readiness-checklist.md`
- `supabase/migrations`

Problema:

Hay estrategia documentada, pero un backup sin restore probado no es garantia.

Solucion:

Ejecutar restore en staging o entorno temporal y documentar:

- fecha;
- fuente del backup;
- destino;
- tiempo de restore;
- verificacion funcional minima;
- responsable.

Beneficio:

Reduce riesgo existencial para 5+ salones. El Adapter Supabase deja de ser solo
codigo y se vuelve operable.

Fuerza: Strong.

## 3. Load Smoke Real Con 5 Salones

Archivos:

- `scripts/seed-staging-smoke.mjs`
- `scripts/cleanup-staging-smoke.mjs`
- `docs/runbooks/load-smoke-5-salons.md`
- `src/features/dashboard`
- `src/features/reports`
- `src/features/appointments`
- `src/features/platform`

Problema:

Los tests funcionales pasan, pero volumen inicial puede revelar N+1, queries
lentas o falta de indices.

Solucion:

Ejecutar seed en staging y medir rutas criticas:

- dashboard;
- agenda;
- crear cita;
- colaboradores;
- clientes;
- reportes;
- Platform overview.

Beneficio:

Mueve la decision de performance de opinion a evidencia.

Fuerza: Strong.

## 4. Observability Provider

Archivos:

- `src/lib/observability/index.ts`
- `src/features/platform/use-cases/*`
- `docs/security.md`
- `.env.local.example`

Problema:

El Adapter existe, pero consola no es suficiente si se quiere operar produccion
con tranquilidad.

Solucion:

Conectar el Adapter a un proveedor real o log drain del hosting sin cambiar los
Modules de negocio.

Beneficio:

La Seam ya existe. Cambiar el Adapter aumenta Leverage sin tocar callers.

Fuerza: Worth exploring antes de produccion seria.

## 5. Reminder Sending Module Si El Producto Lo Promete

Archivos:

- `src/features/reminders`
- `src/features/notifications`
- `docs/reminders-launch-decision.md`

Problema:

`features/reminders` hoy es read Module. Si se promete envio real, falta side
effect, retries, logs y Adapter externo.

Solucion:

Crear use-cases separados:

- `send-reminder`;
- `record-reminder-attempt`;
- `retry-reminder`.

Crear Adapter de proveedor y usar `appointment_reminder_log`.

Beneficio:

Mantiene Locality: la vista de cola no se contamina con side effects.

Fuerza: Condicional / Strong si envio real entra al MVP.

## 6. Limpieza Menor De UI Copy

Archivos:

- `src/app/(dashboard)/recordatorios/page.tsx`

Problema:

Hay una cadena con mojibake.

Solucion:

Corregir texto visible.

Beneficio:

No es arquitectura, pero mejora pulido de produccion.

Fuerza: Worth exploring, rapido.

## Que No Recomiendo Cambiar

- No migrar a microservicios.
- No crear una capa global `services`.
- No crear repositorios genericos para todas las tablas.
- No extraer toda UI route-local de `src/app` solo por tamano.
- No partir `session.ts` sin una Seam real.
- No crear Interfaces abstractas si solo existe un Adapter.
- No borrar ADRs vigentes.
- No implementar recordatorios reales si el producto no los promete.

## Cuanto Falta Para Orden Suficiente

El sistema ya tiene orden suficiente para seguir desarrollando con seguridad.

Falta aproximada:

```text
6% - 8%
```

Trabajo restante para orden casi excelente:

1. Mantener esta auditoria como documento vigente en `docs/README.md`.
2. Corregir mojibake menor de recordatorios.
3. Revisar archivos UI route-local grandes solo cuando haya reuse o reglas
   reales.
4. Mantener `architecture:check` en CI.
5. No permitir nuevos imports directos a data Adapters desde `src/app`.
6. Actualizar ADR 0010 ante cualquier nuevo uso de `service_role`.

Estimacion:

```text
0.5 - 2 dias de trabajo real
```

## Cuanto Falta Para Lanzar A Produccion Con 5 Salones O Mas

Si hablamos de codigo y estructura en repo:

```text
12% - 18% restante
```

Si hablamos de readiness real de operacion, donde hay que tener evidencia
externa:

```text
18% - 25% restante
```

Bloqueantes antes de produccion:

1. Staging separado configurado con secrets reales.
2. Migraciones aplicadas en staging.
3. `npm run test:e2e:staging` pasando contra deploy real.
4. `npm run architecture:health` ejecutado con evidencia reciente.
5. Backup reciente confirmado.
6. Restore probado.
7. Smoke de 5 salones ejecutado y limpiado.
8. Revision de logs Supabase para queries lentas.
9. Confirmar headers en hosting.
10. Definir soporte/responsable para primera semana.
11. Decidir si recordatorios reales entran al lanzamiento.

Estimacion realista:

```text
3 - 7 dias si ya existen cuentas, staging y acceso a hosting/Supabase
1 - 2 semanas si todavia hay que crear entorno, secrets, backups y proceso
```

## Prioridad Recomendada

1. Ejecutar staging E2E y architecture health contra deploy.
2. Ejecutar restore probado.
3. Ejecutar load smoke con 5 salones.
4. Revisar logs y performance de rutas criticas.
5. Corregir copy/encoding menor.
6. Decidir recordatorios reales.

## Conclusion

GlowBook esta bien encaminado como monolito modular. La arquitectura actual es
la adecuada para el producto: mantiene un deploy simple, pero separa
responsabilidades por Module y deja Supabase como autoridad de seguridad.

La parte mas importante ya esta: los Modules criticos existen, tienen
Interfaces claras, Adapters localizados y tests. Lo que falta para lanzar con 5
salones no es una gran reestructura. Falta cerrar evidencia operativa y no
perder la disciplina conseguida.
