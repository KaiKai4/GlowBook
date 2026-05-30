# Fases Derivadas De La Auditoria De Arquitectura

Fecha: 2026-05-29

Fuente: `docs/architecture-audit-2026-05-29.md`

Este documento convierte la auditoria actual en fases de trabajo ejecutables. Continuan el roadmap previo despues de la Fase 9, por eso empiezan en Fase 10.

La direccion arquitectonica no cambia: GlowBook debe seguir como monolito modular feature-first. Estas fases profundizan los Seams ya existentes, reducen deuda tecnica y mejoran Locality sin introducir una arquitectura mas pesada.

## Principios De Estas Fases

1. Mantener `src/app` como Interface de delivery: auth, permisos, parseo, llamada a use-case y render.
2. Mantener `src/features/*/domain` puro: sin React, Next, Supabase ni `server-only`.
3. Mantener `src/features/*/data` como Adapter Supabase/Postgres.
4. Mantener `src/features/*/use-cases` como Interface de negocio para callers de `app`.
5. No crear carpetas vacias ni Seams hipoteticos sin razon.
6. No meter negocio en `src/lib`.
7. Agregar tests cuando un Module concentre reglas, transformaciones o errores de negocio.
8. Mantener SQL/RLS/RPC/constraints como autoridad final de seguridad e integridad.

## Estado Objetivo Despues De Estas Fases

```text
src/app
  -> no conoce repositorios data directamente salvo excepciones documentadas
  -> paginas finas: perfil, permiso, params, use-case, render
  -> actions finas: perfil, permiso, schema, use-case, revalidate

src/features/<dominio>/use-cases
  -> Interfaces de lectura y comando
  -> devuelven view models estables a app

src/features/<dominio>/data
  -> query shape, RPCs, updates y Supabase clients

src/features/<dominio>/domain
  -> reglas puras con tests cuando tienen Depth real

scripts/check-architecture.mjs
  -> bloquea reglas criticas y detecta senales falsas
```

## Fase 10 - Limpiar Senales Falsas Y Endurecer Guardrails

Objetivo: eliminar Seams que no existen y hacer que el arbol no prometa Modules vacios.

Estado: implementada el 2026-05-29.

Problemas que resuelve:

- `src/features/platform/domain` esta vacio.
- `src/features/services/domain` esta vacio.
- `architecture:check` no detecta carpetas vacias sin README.
- El guardrail todavia no ayuda a migrar `app -> data`.

Trabajo:

1. Revisar las carpetas vacias:
   - `src/features/platform/domain`
   - `src/features/services/domain`
2. Borrarlas si no hay un concepto real que viva ahi.
3. Si alguna debe conservarse, agregar un `README.md` corto con:
   - concepto del dominio
   - razon del Seam
   - criterio para crear Modules ahi
4. Extender `scripts/check-architecture.mjs` para detectar carpetas vacias bajo `src/features`.
5. Agregar un modo de advertencia o reporte para imports `src/app -> src/features/*/data`, sin bloquear todavia.

Archivos esperados:

- `scripts/check-architecture.mjs`
- posible eliminacion de carpetas vacias
- posible README en carpetas reservadas

Criterio de terminado:

- No quedan carpetas vacias sin explicacion.
- `npm run architecture:check` reporta senales falsas.
- El equipo puede ver una lista de imports `app -> data` pendientes.

Riesgo: bajo.

Implementacion aplicada:

- Se eliminaron las carpetas vacias:
  - `src/features/platform/domain`
  - `src/features/services/domain`
- `scripts/check-architecture.mjs` ahora falla si encuentra carpetas vacias bajo `src/features`.
- `scripts/check-architecture.mjs` ahora muestra un reporte no bloqueante de imports `src/app -> src/features/*/data` para guiar las Fases 11-13.

## Fase 11 - Crear Modules De Lectura Para Paginas Simples Del Salon

Objetivo: reducir imports directos desde paginas de Salon hacia `features/*/data`.

Estado: implementada el 2026-05-29.

Problemas que resuelve:

- `services/page.tsx` importa `services.repo`.
- `salon/page.tsx` importa `salon.repo`.
- `customers/page.tsx` importa `customers.repo`.
- `plantillas/page.tsx` importa `notification-templates.repo`.
- `roles/page.tsx` importa `roles.repo`.

Trabajo:

1. Crear `src/features/services/use-cases/get-service-catalog.ts`.
2. Crear `src/features/salon/use-cases/get-salon-settings.ts`.
3. Crear `src/features/customers/use-cases/get-customers-page.ts`.
4. Crear `src/features/notifications/use-cases/get-template-settings.ts`.
5. Crear `src/features/access/use-cases/get-roles-page.ts`.
6. Cambiar paginas para consumir esos use-cases.
7. Mantener schemas y actions como estan si ya son finas.
8. Agregar tests solo donde haya mapeo, filtros o errores no triviales.

Archivos esperados:

- `src/features/services/use-cases/get-service-catalog.ts`
- `src/features/salon/use-cases/get-salon-settings.ts`
- `src/features/customers/use-cases/get-customers-page.ts`
- `src/features/notifications/use-cases/get-template-settings.ts`
- `src/features/access/use-cases/get-roles-page.ts`
- paginas actualizadas en `src/app/(dashboard)`

Criterio de terminado:

- Esas paginas ya no importan `features/*/data`.
- Cada pagina queda como auth/permission + use-case + render.
- Los view models tienen nombres claros y estables.
- `npm run test`, `npm run type-check`, `npm run lint` y `npm run build` pasan.

Riesgo: medio-bajo.

Implementacion aplicada:

- Se crearon Modules de lectura:
  - `src/features/services/use-cases/get-service-catalog.ts`
  - `src/features/salon/use-cases/get-salon-settings.ts`
  - `src/features/customers/use-cases/get-customers-page.ts`
  - `src/features/notifications/use-cases/get-template-settings.ts`
  - `src/features/access/use-cases/get-roles-page.ts`
- Se actualizaron las paginas:
  - `src/app/(dashboard)/services/page.tsx`
  - `src/app/(dashboard)/salon/page.tsx`
  - `src/app/(dashboard)/customers/page.tsx`
  - `src/app/(dashboard)/plantillas/page.tsx`
  - `src/app/(dashboard)/roles/page.tsx`
- Se agregaron tests para los Modules con transformaciones:
  - `src/features/services/use-cases/get-service-catalog.test.ts`
  - `src/features/salon/use-cases/get-salon-settings.test.ts`
  - `src/features/customers/use-cases/get-customers-page.test.ts`
  - `src/features/access/use-cases/get-roles-page.test.ts`
- El reporte `app -> data` de `architecture:check` queda reducido a lecturas complejas de Fase 12 y Plataforma de Fase 13.

## Fase 12 - Profundizar Lecturas Complejas De Detalle Y Layout

Objetivo: sacar composicion compleja y Supabase directo de paginas/layouts del dashboard.

Problemas que resuelve:

- `dashboard/layout.tsx` lee Salon directo para tema, estado y funciones.
- `employees/[id]/page.tsx` mezcla colaborador, roles, categorias, invitaciones y profile linked role.
- `appointments/[id]/page.tsx` lee detalle de cita y timezone con Supabase directo.

Trabajo:

1. Crear `src/features/salon/use-cases/get-dashboard-shell.ts`.
2. Crear `src/features/employees/use-cases/get-employee-detail.ts`.
3. Crear `src/features/appointments/use-cases/get-appointment-detail.ts`.
4. Mover query shape y mapeos a esos use-cases.
5. Dejar paginas/layout como:
   - require profile
   - permission check
   - call use-case
   - render
6. Agregar tests para los use-cases con repos mockeados si hay mapeo relevante.

Archivos esperados:

- `src/features/salon/use-cases/get-dashboard-shell.ts`
- `src/features/employees/use-cases/get-employee-detail.ts`
- `src/features/appointments/use-cases/get-appointment-detail.ts`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/employees/[id]/page.tsx`
- `src/app/(dashboard)/appointments/[id]/page.tsx`

Criterio de terminado:

- No hay `createSupabaseServerClient()` en esas paginas/layout.
- `employees/[id]` y `appointments/[id]` reciben view models.
- Las paginas no conocen query shape.
- Se mantiene la validacion de tenant y permisos.

Resultado implementado:

- Se agregaron los read Modules:
  - `src/features/salon/use-cases/get-dashboard-shell.ts`
  - `src/features/employees/use-cases/get-employees-page.ts`
  - `src/features/employees/use-cases/get-employee-detail.ts`
  - `src/features/appointments/use-cases/get-appointment-detail.ts`
- Se agrego `findDashboardShellSalon` en `src/features/salon/data/salon.repo.ts` para concentrar la lectura del shell del dashboard.
- `src/app/(dashboard)/layout.tsx` ya no crea Supabase client ni conoce el `select` de Salon; solo arma la navegacion con el view model.
- `src/app/(dashboard)/employees/page.tsx`, `src/app/(dashboard)/employees/[id]/page.tsx` y `src/app/(dashboard)/appointments/[id]/page.tsx` ya no importan repositorios `data`.
- `employees/[id]` mantiene roles, categorias, servicios, horarios e invitacion pendiente desde `getEmployeeDetail`.
- `appointments/[id]` mantiene validacion de tenant, timezone y estado desde `getAppointmentDetail`.
- Se agregaron tests de mapeo:
  - `src/features/salon/use-cases/get-dashboard-shell.test.ts`
  - `src/features/employees/use-cases/get-employees-page.test.ts`
  - `src/features/employees/use-cases/get-employee-detail.test.ts`
  - `src/features/appointments/use-cases/get-appointment-detail.test.ts`
- `architecture:check` queda reducido a los imports `app -> data` de Plataforma, que pertenecen a Fase 13.

Riesgo: medio.

## Fase 13 - Normalizar Lecturas De Plataforma

Objetivo: dar a Plataforma la misma Interface de lectura que el Salon operativo.

Problemas que resuelve:

- `admin/page.tsx` importa `salons.repo` e `invitations.repo`.
- `admin/reports/page.tsx` importa `feedback-moderation.repo`.
- `admin/salons/page.tsx` importa `salon-overviews.repo`.

Trabajo:

1. Crear `src/features/platform/use-cases/get-platform-admin-home.ts`.
2. Crear `src/features/platform/use-cases/get-platform-feedback-reports.ts`.
3. Crear `src/features/platform/use-cases/get-platform-salon-overviews.ts`.
4. Cambiar paginas de Plataforma para consumir esos use-cases.
5. Mantener los Adapters privilegiados en `features/platform/data`.
6. Agregar tests para mapeos o errores si existen.

Archivos esperados:

- `src/features/platform/use-cases/get-platform-admin-home.ts`
- `src/features/platform/use-cases/get-platform-feedback-reports.ts`
- `src/features/platform/use-cases/get-platform-salon-overviews.ts`
- paginas en `src/app/(platform)/admin`

Criterio de terminado:

- Paginas de Plataforma no importan `features/platform/data`.
- `service_role` sigue limitado a los Adapters autorizados por ADR 0010.
- `platform_salon_overviews()` sigue siendo el read model de Salon overview.

Resultado implementado:

- Se agregaron los read Modules de Plataforma:
  - `src/features/platform/use-cases/get-platform-admin-home.ts`
  - `src/features/platform/use-cases/get-platform-feedback-reports.ts`
  - `src/features/platform/use-cases/get-platform-salon-overviews.ts`
- `src/app/(platform)/admin/page.tsx`, `src/app/(platform)/admin/reports/page.tsx` y `src/app/(platform)/admin/salons/page.tsx` consumen view models y ya no importan `features/platform/data`.
- Los Adapters con `service_role` se mantienen en `src/features/platform/data`, alineados con ADR 0010.
- `get-platform-salon-overviews.ts` conserva `findSalonOverviews()` como Interface del read model respaldado por `platform_salon_overviews()`.
- Se agregaron tests:
  - `src/features/platform/use-cases/get-platform-admin-home.test.ts`
  - `src/features/platform/use-cases/get-platform-feedback-reports.test.ts`
  - `src/features/platform/use-cases/get-platform-salon-overviews.test.ts`
- `architecture:check` ya no reporta imports `app -> data` pendientes.

Riesgo: medio-bajo.

## Fase 14 - Profundizar Commands De Citas

Objetivo: separar orquestacion de negocio de query shape y escrituras Supabase en appointments.

Problemas que resuelve:

- `create-appointment.ts` contiene muchas queries y mapeo SQL.
- `cancel-appointment.ts`, `confirm-appointment.ts`, `complete-appointment.ts` y `appointment-availability.ts` crean Supabase client directamente.
- Tests unitarios de use-cases de commands requieren mockear Supabase global o usar integracion.

Trabajo:

1. Crear o ampliar Adapter de comandos:
   - `src/features/appointments/data/appointment-commands.repo.ts`
   - o dividir `appointments.repo.ts` en lectura/comando si tiene sentido.
2. Mover al Adapter:
   - find customer for appointment
   - find salon scheduling config
   - find services and employees for assignments
   - find assignment capabilities
   - update appointment status
   - update `blocks_calendar`
   - apply item discount
   - call `create_appointment`
3. Dejar use-cases con:
   - validacion de input
   - llamada a domain Modules
   - llamada al Adapter
   - mapeo de errores de negocio
4. Agregar tests unitarios de use-cases con Adapter mockeado.
5. Mantener la prueba RPC existente para asegurar contrato SQL.

Archivos esperados:

- `src/features/appointments/data/appointment-commands.repo.ts`
- cambios en `src/features/appointments/use-cases/*`
- tests de use-cases de appointments commands

Criterio de terminado:

- Use-cases de appointments commands no importan `createSupabaseServerClient`.
- Query shape vive en `data`.
- Domain Modules siguen puros.
- RPC `create_appointment` sigue siendo autoridad final.
- Tests unitarios y RPC test pasan.

Resultado implementado:

- Se creo `src/features/appointments/data/appointment-commands.repo.ts` como Adapter de comandos de citas.
- Se movieron al Adapter:
  - lectura de estado de cita para transiciones
  - lectura de customer/salon/business hours/services/employees para crear cita
  - lectura de capacidades por colaborador
  - horarios y slots ocupados por colaborador
  - actualizacion de estado de cita
  - liberacion de `blocks_calendar`
  - descuento por item
  - llamada a RPC `create_appointment`
  - slots ocupados por dia local del Salon para el wizard
- `create-appointment.ts`, `cancel-appointment.ts`, `confirm-appointment.ts`, `complete-appointment.ts` y `appointment-availability.ts` ya no importan `createSupabaseServerClient`.
- `appointments.repo.ts` queda enfocado en lecturas de calendario/detalle y se removieron funciones de comando que quedaron sin uso.
- La RPC `create_appointment` sigue siendo el contrato final de escritura para crear citas.
- Se agregaron tests unitarios con Adapter mockeado:
  - `src/features/appointments/use-cases/create-appointment.test.ts`
  - `src/features/appointments/use-cases/appointment-lifecycle-commands.test.ts`
  - `src/features/appointments/use-cases/appointment-availability.test.ts`
- El test RPC existente se mantiene para validar el contrato SQL cuando existan `SUPABASE_TEST_EMAIL` y `SUPABASE_TEST_PASSWORD`.

Riesgo: medio.

## Fase 15 - Tests Secundarios Donde La Interface Ya Existe

Objetivo: cubrir Modules que ya tienen Interface estable pero aun no tienen red de seguridad suficiente.

Problemas que resuelve:

- `get-dashboard-overview.ts` no tiene test.
- `reports/domain/period.ts` no tiene test directo.
- Customer lifecycle/temporary/duplicates tienen reglas de negocio sin tests suficientes.
- `update-message-template.ts` no tiene test.
- `delete-salon.ts` y `set-feedback-report-status.ts` no tienen tests.

Trabajo:

1. Agregar tests para:
   - `src/features/dashboard/use-cases/get-dashboard-overview.test.ts`
   - `src/features/reports/domain/period.test.ts`
   - `src/features/customers/use-cases/customer-lifecycle.test.ts`
   - `src/features/customers/use-cases/customer-temporary.test.ts`
   - `src/features/customers/use-cases/customer-duplicates.test.ts`
   - `src/features/notifications/use-cases/update-message-template.test.ts`
   - `src/features/platform/use-cases/delete-salon.test.ts`
   - `src/features/platform/use-cases/set-feedback-report-status.test.ts`
2. Priorizar tests que cubran errores de negocio, ownership y mapeos.
3. Evitar tests de detalles triviales si no aumentan Leverage.

Archivos esperados:

- nuevos `*.test.ts` en features listadas

Criterio de terminado:

- Cambios en dashboard, periodos, customers, plantillas y Plataforma fallan rapido.
- Tests cruzan la Interface real del Module.
- No se mockea mas de lo necesario.

Resultado implementado:

- Se agregaron tests de dashboard:
  - `src/features/dashboard/use-cases/get-dashboard-overview.test.ts`
- Se agregaron tests de periodos de reportes:
  - `src/features/reports/domain/period.test.ts`
- Se agregaron tests de reglas de clientes:
  - `src/features/customers/use-cases/customer-lifecycle.test.ts`
  - `src/features/customers/use-cases/customer-temporary.test.ts`
  - `src/features/customers/use-cases/customer-duplicates.test.ts`
- Se agrego test de plantillas:
  - `src/features/notifications/use-cases/update-message-template.test.ts`
- Se agregaron tests de Plataforma:
  - `src/features/platform/use-cases/delete-salon.test.ts`
  - `src/features/platform/use-cases/set-feedback-report-status.test.ts`
- Los tests cubren errores de negocio, mapeos de view model, ownership por `salonId`, proteccion contra duplicados archivados y confirmaciones destructivas.

Riesgo: bajo.

## Fase 16 - Endurecer Guardrails De Dependencias

Objetivo: convertir las reglas pendientes de arquitectura en enforcement gradual.

Problemas que resuelve:

- `app -> data` sigue siendo posible.
- Use-cases con Supabase directo siguen siendo posibles.
- `components/layout -> features` esta permitido, pero no esta documentado como excepcion controlada.

Trabajo:

1. Actualizar `scripts/check-architecture.mjs` para bloquear `app -> features/*/data` cuando Fases 11-13 esten terminadas.
2. Agregar allowlist temporal si queda una excepcion justificada.
3. Agregar advertencia para `features/*/use-cases -> createSupabaseServerClient`.
4. Documentar la excepcion actual de `components/layout`:
   - puede importar tipos de permisos/funciones del Salon
   - no puede importar Server Actions ni repositorios
5. Actualizar README o ADR 0009 si una regla nueva se vuelve load-bearing.

Archivos esperados:

- `scripts/check-architecture.mjs`
- `README.md` o `docs/adr/0009-modular-monolith-feature-architecture.md`

Criterio de terminado:

- `npm run architecture:check` bloquea nuevas regresiones.
- No se puede reintroducir `app -> data` accidentalmente.
- Las excepciones quedan documentadas y auditables.

Resultado implementado:

- `scripts/check-architecture.mjs` ahora bloquea imports `src/app -> features/*/data`.
- El reporte no bloqueante de migracion `app -> data` fue reemplazado por una violacion real del guardrail.
- `scripts/check-architecture.mjs` agrega advertencias para imports `features/*/use-cases -> @/lib/supabase/server`.
- Se documento la excepcion controlada `components/layout -> features` en `docs/adr/0009-modular-monolith-feature-architecture.md`.
- La excepcion permite solo Interfaces estables para navegacion/chrome y prohibe `data`, Server Actions, use-cases con lecturas/escrituras y query shape.

Riesgo: bajo.

## Orden Recomendado

```text
Fase 10  Limpieza de senales falsas y guardrail de carpetas/imports
Fase 11  Read Modules para paginas simples del Salon
Fase 12  Read Modules complejos para layout, employee detail y appointment detail
Fase 13  Read Modules de Plataforma
Fase 14  Commands de appointments con Adapter profundo
Fase 15  Tests secundarios de Interfaces existentes
Fase 16  Guardrails estrictos y documentacion de excepciones
```

## Mapa De Hallazgos A Fases

| Hallazgo de auditoria | Fase |
|---|---|
| Carpetas `domain` vacias | Fase 10 |
| Guardrail no detecta carpetas vacias | Fase 10 |
| Guardrail no reporta `app -> data` | Fase 10 y Fase 16 |
| Paginas simples importan repositorios `data` | Fase 11 |
| Layout y paginas detalle tienen Supabase directo o composicion compleja | Fase 12 |
| Paginas de Plataforma importan `data` directo | Fase 13 |
| Use-cases de appointments crean Supabase client directo | Fase 14 |
| Tests secundarios pendientes | Fase 15 |
| Reglas arquitectonicas pendientes de enforcement | Fase 16 |

## Que No Hacer

- No cambiar a microservicios.
- No crear una capa global `services`.
- No mover negocio a `src/lib`.
- No crear Interfaces abstractas si solo existe un Adapter y no hay presion real.
- No extraer UI route-local solo por tamano si no contiene reglas de negocio.
- No duplicar reglas TypeScript/SQL sin documentar autoridad.
- No bloquear `app -> data` antes de migrar las lecturas existentes o crear una allowlist temporal.

## Primer Sprint Sugerido

El primer sprint deberia ser Fase 10 + una parte de Fase 11:

1. Limpiar carpetas `domain` vacias.
2. Mejorar `architecture:check`.
3. Crear `get-service-catalog.ts`.
4. Crear `get-salon-settings.ts`.
5. Cambiar `services/page.tsx` y `salon/page.tsx`.
6. Correr `npm run test`, `npm run type-check`, `npm run lint`, `npm run build`.

Ese sprint reduce deuda visible sin tocar citas, Auth Admin ni RLS.
