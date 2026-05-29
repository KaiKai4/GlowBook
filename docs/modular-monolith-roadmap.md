# Roadmap Para Monolito Modular - GlowBook

Fecha: 2026-05-28

Este roadmap convierte `docs/architecture-audit.md` en fases de trabajo ejecutables. La idea no es rehacer GlowBook, sino profundizar el monolito modular que ya existe: mas Locality, mas Depth, menos Implementation dentro de rutas, menos deuda tecnica y mejores Interfaces entre `app`, `features`, `lib` y Supabase.

## Principios De Trabajo

1. No hacer un refactor masivo.
2. Cambiar una zona por fase y dejarla funcionando.
3. Mover reglas hacia Modules profundos, no hacia helpers genericos.
4. Mantener `domain` libre de Next, React y Supabase.
5. Mantener `app` como Interface de entrada: auth, permission, parseo, use-case y render.
6. Mantener Supabase como Adapter de seguridad y persistencia, con RLS/RPC/constraints documentados.
7. Agregar tests donde el nuevo Seam concentre reglas reales.

## Estado Objetivo

```text
src/app
  -> rutas, layouts, Server Actions finas, render

src/features/<dominio>
  -> schemas
  -> domain      # reglas puras cuando existan
  -> data        # Adapter Supabase/Postgres
  -> use-cases   # Interface principal de negocio

src/components
  -> UI y layout sin depender de src/app

src/lib
  -> infraestructura transversal y Adapters base

supabase
  -> seguridad, RLS, RPCs, constraints y triggers
```

## Fase 0 - Congelar Contratos Arquitectonicos

Objetivo: dejar claro que arquitectura se esta construyendo antes de mover codigo.

Problemas que resuelve:

- README default de Next no explica GlowBook.
- La regla `app -> use-cases -> domain + data` existe en `CLAUDE.md`, pero no en ADR.
- El uso de `service_role` tiene excepciones legitimas, pero no estan formalizadas.
- Las reglas SQL vs TypeScript no tienen un mapa de responsabilidad.

Trabajo:

1. Reemplazar `README.md` con una guia real del proyecto.
2. Crear ADR de monolito modular feature-first.
3. Crear ADR de usos permitidos de `service_role`.
4. Crear `docs/database-contracts.md`.
5. Documentar reglas de imports:
   - `app` puede importar `features`, `components`, `lib`.
   - `features/domain` no importa `app`, `components`, Supabase, React ni Next.
   - `components/ui` no importa `features` ni `app`.
   - `components/layout` no importa rutas de `app`.

Archivos esperados:

- `README.md`
- `docs/adr/0009-modular-monolith-feature-architecture.md`
- `docs/adr/0010-server-only-admin-adapter-exceptions.md`
- `docs/database-contracts.md`

Criterio de terminado:

- Un developer puede leer README + ADRs y entender donde poner una nueva regla, query, action o pantalla.
- `service_role` tiene una lista de usos permitidos.
- Cada RPC/trigger/constraint importante tiene un owner conceptual en TypeScript o en SQL.

## Fase 1 - Limpieza De Senales Falsas Y Ruido

Objetivo: quitar carpetas y assets que parecen arquitectura, pero no tienen Implementation real.

Estado: implementada el 2026-05-28.

Problemas que resuelve:

- Carpetas vacias que simulan Seams inexistentes.
- Assets default de Next.
- Carpeta `supabase/.temp` en el root del workspace que puede confundirse con Supabase real.

Trabajo:

1. Revisar y decidir si borrar o documentar:
   - `src/app/(platform)/admin/invitations`
   - `src/app/api/webhooks`
   - `src/features/access/use-cases`
   - `src/features/customers/domain`
   - `src/features/employees/domain`
   - `src/features/services/use-cases`
2. Borrar assets default no usados de `public`.
3. Documentar que `glowbook/supabase` es la fuente real de migraciones.
4. Si una carpeta vacia representa trabajo proximo, agregar un `README.md` corto dentro de ella con proposito y criterio para crear Modules ahi.

Criterio de terminado:

- No quedan carpetas vacias sin explicacion.
- La estructura deja de prometer Modules que no existen.
- El arbol de carpetas es mas navegable para humanos y agentes.

Resultado:

- Se verificaron y eliminaron las carpetas vacias:
  - `src/app/(platform)/admin/invitations`
  - `src/app/api/webhooks`
  - `src/features/access/use-cases`
  - `src/features/customers/domain`
  - `src/features/employees/domain`
  - `src/features/services/use-cases`
- Se verifico que los SVG default de Next en `public/` no se usaban en codigo y se eliminaron.
- Se elimino `public/` al quedar vacia.
- Se verifico que la carpeta externa `supabase/.temp` contiene metadata de Supabase CLI y se conservo.
- Se documento en `README.md` que `glowbook/supabase/migrations` es la fuente real de migraciones.

## Fase 2 - Sacar Reportes De `src/app`

Objetivo: convertir `reports` en un Module profundo y testeable.

Estado: implementada el 2026-05-28.

Por que primero:

- `src/app/(dashboard)/reports/page.tsx` concentra mucha logica de negocio.
- No existe `features/reports`.
- Es el mejor primer patron para extraer lecturas complejas.

Problemas que resuelve:

- Pagina con demasiada Implementation.
- Calculos de revenue, avg ticket, no-show y breakdowns sin tests.
- Query shape y view model acoplados al render.

Trabajo:

1. Crear `src/features/reports/`.
2. Crear `src/features/reports/schemas.ts` para filtros de periodo.
3. Crear `src/features/reports/domain/metrics.ts` para calculos puros:
   - revenue
   - avg ticket
   - no-show rate
   - breakdown por estado
   - breakdown por colaborador
   - breakdown por Servicio
4. Crear `src/features/reports/data/reports.repo.ts` para lecturas Supabase.
5. Crear `src/features/reports/use-cases/get-operational-report.ts`.
6. Reducir `src/app/(dashboard)/reports/page.tsx` a:
   - `requireProfile`
   - permiso
   - parseo de params
   - llamada al use-case
   - render de `ReportsView`
7. Agregar tests para `features/reports/domain/metrics.test.ts`.

Criterio de terminado:

- `reports/page.tsx` ya no calcula metricas.
- Las metricas se prueban sin Next runtime.
- El use-case devuelve un view model estable para `ReportsView`.

Resultado:

- Se creo `src/features/reports` con:
  - `schemas.ts` para validar filtros de periodo.
  - `domain/period.ts` para rangos de presets por zona horaria.
  - `domain/metrics.ts` para calculos puros de reportes.
  - `data/reports.repo.ts` como Adapter Supabase server-only.
  - `use-cases/get-operational-report.ts` como Interface de lectura.
- `src/app/(dashboard)/reports/page.tsx` quedo reducido a perfil, permiso, parseo de params, llamada al use-case y render.
- Se agregaron tests unitarios en `src/features/reports/domain/metrics.test.ts`.

## Fase 3 - Crear Modules De Lectura Para Dashboard, Agenda Y Recordatorios

Objetivo: sacar queries y agregaciones de paginas de dashboard.

Estado: implementada el 2026-05-28.

Problemas que resuelve:

- `src/app/(dashboard)/page.tsx` mezcla metricas, queries y UI.
- `appointments/page.tsx` arma calendario y mezcla permisos, timezone, business hours, empleados y plantillas.
- `appointments/new/page.tsx` arma datos iniciales del wizard con queries directas.
- `recordatorios/page.tsx` calcula rango, obtiene citas, plantillas y colaboradores.

Trabajo:

1. Crear `src/features/dashboard/use-cases/get-dashboard-overview.ts`.
2. Crear `src/features/appointments/use-cases/get-calendar-view.ts`.
3. Crear `src/features/appointments/use-cases/get-appointment-wizard-data.ts`.
4. Crear `src/features/notifications/use-cases/get-reminder-queue.ts`.
5. Mover helpers de fecha/calendario route-local a Modules de dominio o use-case si contienen reglas del negocio.
6. Evitar casts `as unknown as Parameters<...>` creando view models tipados.

Archivos a reducir:

- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/appointments/page.tsx`
- `src/app/(dashboard)/appointments/new/page.tsx`
- `src/app/(dashboard)/recordatorios/page.tsx`

Criterio de terminado:

- Las paginas solo autentican, autorizan, llaman use-cases y renderizan.
- Cada pantalla recibe un view model tipado.
- Las reglas de rango/timezone no quedan duplicadas en paginas.

Resultado:

- Se creo `src/features/dashboard` con:
  - `data/dashboard.repo.ts` para lecturas Supabase del overview.
  - `use-cases/get-dashboard-overview.ts` para metricas, servicios mas usados y citas por confirmar.
- Se creo `src/features/appointments/view-models.ts` para contratos de agenda y wizard.
- Se creo `src/features/appointments/domain/calendar.ts` para reglas puras de calendario:
  - semana visible
  - dias abiertos
  - rango horario del calendario
  - conteo de citas activas
  - normalizacion de vista
- Se creo `src/features/appointments/use-cases/get-calendar-view.ts`.
- Se creo `src/features/appointments/use-cases/get-appointment-wizard-data.ts`.
- Se creo `src/features/notifications/view-models.ts`.
- Se creo `src/features/notifications/use-cases/get-reminder-queue.ts`.
- Se agregaron lecturas compartidas en repos existentes:
  - `findActiveEmployeeNames()`
  - `findSalonIdentity()`
  - `findAppointmentSalonConfig()`
- `src/app/(dashboard)/page.tsx`, `appointments/page.tsx`, `appointments/new/page.tsx` y `recordatorios/page.tsx` quedaron sin queries Supabase directas.
- Se eliminaron los casts `as unknown as Parameters<...>` en agenda y recordatorios usando view models tipados.

## Fase 4 - Normalizar Server Actions Como Interfaces Finas

Objetivo: hacer que todas las Server Actions sigan la misma forma.

Estado: implementada el 2026-05-28.

Regla objetivo:

```text
Server Action =
  requireActiveProfile/requirePlatformAdmin
  + permission check
  + parse FormData/input
  + call use-case
  + revalidatePath
```

No deberian:

- Crear queries Supabase.
- Mapear errores SQL complejos.
- Decidir reglas de negocio.
- Importar repositorios directos salvo en transiciones muy simples y documentadas.

Problemas que resuelve:

- `services/actions.ts` llama repos directo.
- `salon/actions.ts` usa Supabase directo.
- `plantillas/actions.ts` llama repo directo.
- `roles/actions.ts` llama repo directo.

Trabajo por dominio:

1. `features/services/use-cases`
   - `create-category.ts`
   - `create-service.ts`
   - `update-service.ts`
2. `features/salon/use-cases`
   - `update-salon-info.ts`
   - `update-salon-theme.ts`
   - `update-salon-background.ts`
   - `update-business-hours.ts`
3. `features/notifications/use-cases`
   - `update-message-template.ts`
4. `features/access/use-cases`
   - `create-role.ts`
   - `update-role-permissions.ts`
   - `assign-role.ts`
   - `delete-role.ts`

Criterio de terminado:

- Las actions de esos dominios no importan `createSupabaseServerClient`.
- Las actions no importan repositorios de `data` directamente.
- Los errores de negocio viven en use-cases.
- Hay tests para al menos los use-cases con reglas no triviales.

Resultado:

- Se crearon use-cases de servicios:
  - `src/features/services/use-cases/create-category.ts`
  - `src/features/services/use-cases/create-service.ts`
  - `src/features/services/use-cases/update-service.ts`
- Se crearon use-cases de salon:
  - `src/features/salon/use-cases/update-salon-info.ts`
  - `src/features/salon/use-cases/update-salon-theme.ts`
  - `src/features/salon/use-cases/update-salon-background.ts`
  - `src/features/salon/use-cases/update-business-hours.ts`
- Se creo `src/features/notifications/use-cases/update-message-template.ts`.
- Se crearon use-cases de acceso:
  - `src/features/access/use-cases/create-role.ts`
  - `src/features/access/use-cases/update-role-permissions.ts`
  - `src/features/access/use-cases/assign-role.ts`
  - `src/features/access/use-cases/delete-role.ts`
- Las actions de `services`, `salon`, `plantillas` y `roles` quedaron sin imports directos a repositorios `data` ni `createSupabaseServerClient`.
- Se movio el mapeo de errores de negocio hacia use-cases.
- Se reforzaron adapters Supabase existentes:
  - `roles.repo.ts` ahora verifica errores al resolver permisos, borrar permisos e insertar permisos.
  - `deleteRole()` borra por `id` y `salon_id`.
  - `salon.repo.ts` concentra escrituras de nombre, tema, fondo y horarios.
- Se sincronizo `src/features/access/domain/permissions.ts` con Supabase agregando `appointments.view`, que ya existe en migraciones y en `src/lib/auth/permissions.ts`.
- Se agregaron tests para use-cases:
  - `src/features/services/use-cases/service-catalog.test.ts`
  - `src/features/access/use-cases/roles.test.ts`

## Fase 5 - Corregir Dependencias Invertidas De UI Y Layout

Objetivo: asegurar que `components` no dependa de `app`.

Problemas que resuelve:

- `src/components/layout/feedback-bubble.tsx` importa `@/app/(dashboard)/feedback/actions`.

Trabajo:

1. Crear `src/features/feedback/use-cases/submit-feedback.ts`.
2. Dejar `src/app/(dashboard)/feedback/actions.ts` como Adapter fino que llama el use-case.
3. Cambiar `FeedbackBubble` para recibir una funcion/handler desde el layout o envolverlo con un Module route-local.
4. Mantener `components/layout/feedback-bubble.tsx` como UI pura.

Criterio de terminado:

- Ningun archivo en `src/components` importa desde `src/app`.
- `feedback-bubble.tsx` solo conoce props, UI y schemas necesarios.
- El submit de feedback tiene un use-case testeable.

## Fase 6 - Aislar Adapters Privilegiados Y Acceso De Colaboradores

Objetivo: mejorar Locality del uso de `service_role` y Supabase Admin Auth.

Problemas que resuelve:

- `employee-access.ts` tiene muchas responsabilidades.
- `employee-profile.ts` toca Admin Auth al cambiar email.
- `platform.repo.ts` y flujos de invitacion usan Admin Adapter de forma dispersa.
- `service_role` esta protegido tecnicamente, pero no como contrato de arquitectura.

Trabajo:

1. Crear un Adapter server-only para operaciones Auth Admin, por ejemplo:
   - crear usuario owner
   - borrar usuario
   - actualizar password/confirmacion
   - listar/buscar usuario por email
2. Crear un Adapter de invitaciones de colaborador si el flujo sigue creciendo.
3. Reducir `employee-access.ts` a reglas de orquestacion.
4. Reducir `employee-profile.ts` para que no conozca detalles de Auth Admin.
5. Documentar en ADR los Modules autorizados a usar el Adapter admin.

Criterio de terminado:

- `createSupabaseAdminClient()` no aparece en use-cases de forma repetida.
- Operaciones privilegiadas pasan por un Adapter con Interface pequena.
- Los tests pueden mockear el Adapter sin mockear Supabase global.

## Fase 7 - Profundizar Plataforma Y Operaciones Cross-Tenant

Objetivo: separar responsabilidades dentro de `features/platform`.

Problemas que resuelve:

- `platform.repo.ts` mezcla salones, invitaciones, feedback, eliminacion y overview.
- `findSalonOverviews()` puede volverse N+1.
- `invite-salon.ts` recibe `FormData`, mezclando route input con use-case.

Trabajo:

1. Separar `platform.repo.ts` en Modules mas especificos si el volumen lo justifica:
   - `salons.repo.ts`
   - `invitations.repo.ts`
   - `feedback-moderation.repo.ts`
   - `delete-salon.repo.ts`
2. Cambiar use-cases para recibir input tipado, no `FormData`.
3. Evaluar un read model SQL/RPC para `SalonOverview`.
4. Mantener `delete_salon_completely` como fuente de verdad transaccional.

Criterio de terminado:

- Cada Module de plataforma tiene una razon clara para cambiar.
- Los use-cases no dependen de FormData.
- La lectura de overview no escala con N queries por salon si el numero de salones crece.

## Fase 8 - Consolidar Conceptos Cruzados Del Dominio

Objetivo: decidir ownership de conceptos que cruzan features.

Problemas que resuelve:

- "Asignacion de colaborador" cruza `services`, `employees` y `appointments`.
- Reglas de business hours del Salon afectan agenda.
- Recordatorio operativo vive entre `notifications`, `appointments` y `recordatorios`.

Trabajo:

1. Revisar `CONTEXT.md` y confirmar nombres de conceptos:
   - Asignacion de colaborador
   - Recordatorio operativo
   - Configuracion de agenda
2. Para cada concepto, decidir Module owner.
3. Si el concepto no esta bien definido en `CONTEXT.md`, actualizarlo antes de crear carpetas.
4. Evitar duplicar reglas en dos features sin documentarlo.

Criterio de terminado:

- Cada concepto cruzado tiene un owner.
- Los imports entre features tienen una razon de dominio, no de conveniencia.
- Las reglas duplicadas entre TypeScript y SQL estan documentadas como defensa en profundidad.

## Fase 9 - Tests Y Guardrails Arquitectonicos

Objetivo: que el monolito modular sea mantenible cuando crezca.

Problemas que resuelve:

- Faltan tests para reports, salon, services, roles, reminders y timezone.
- No hay guardrail automatico para imports indeseados.

Trabajo:

1. Agregar tests para:
   - `features/reports/domain/metrics.test.ts`
   - `features/salon/use-cases/update-business-hours.test.ts`
   - `features/services/use-cases/*.test.ts`
   - `features/access/use-cases/*.test.ts`
   - `features/notifications/use-cases/get-reminder-queue.test.ts`
   - `src/lib/utils/dates.test.ts`
2. Evaluar una regla de lint o script que bloquee:
   - imports desde `components` hacia `app`
   - imports desde `features/*/domain` hacia Supabase, Next o React
   - imports directos de `createSupabaseAdminClient` fuera de Adapters autorizados
3. Mantener comandos de verificacion:
   - `npm run test`
   - `npm run type-check`
   - `npm run lint`
   - `npm run build`

Criterio de terminado:

- Cada Module profundo nuevo tiene test.
- Las reglas de dependencia no dependen solo de memoria.
- Cambios en reportes, agenda, permisos o plantillas fallan rapido si rompen reglas.

## Orden Recomendado

```text
Fase 0  Contratos y docs
Fase 1  Limpieza de ruido
Fase 2  Reports como primer Module profundo de lectura
Fase 3  Dashboard, agenda y recordatorios
Fase 4  Server Actions finas
Fase 5  Dependencias UI correctas
Fase 6  Adapters privilegiados
Fase 7  Plataforma cross-tenant
Fase 8  Conceptos cruzados del dominio
Fase 9  Tests y guardrails
```

## Mapa De Problemas A Fases

| Problema detectado | Fase |
|---|---|
| README default | Fase 0 |
| Falta ADR de monolito modular | Fase 0 |
| Falta contrato de `service_role` | Fase 0 y Fase 6 |
| Falta mapa SQL vs TypeScript | Fase 0 y Fase 8 |
| Carpetas vacias | Fase 1 |
| Assets default | Fase 1 |
| `reports/page.tsx` con demasiada Implementation | Fase 2 |
| `dashboard/page.tsx` con queries y metricas | Fase 3 |
| `appointments/page.tsx` arma calendario con queries directas | Fase 3 |
| `appointments/new/page.tsx` arma wizard data en ruta | Fase 3 |
| `recordatorios/page.tsx` arma worklist en ruta | Fase 3 |
| `services/actions.ts` llama repos directo | Fase 4 |
| `salon/actions.ts` usa Supabase directo | Fase 4 |
| `plantillas/actions.ts` llama repo directo | Fase 4 |
| `roles/actions.ts` llama repo directo | Fase 4 |
| `components/layout/feedback-bubble.tsx` importa desde `app` | Fase 5 |
| `employee-access.ts` demasiado ancho | Fase 6 |
| `employee-profile.ts` toca Admin Auth | Fase 6 |
| `platform.repo.ts` demasiado ancho | Fase 7 |
| `findSalonOverviews()` potencial N+1 | Fase 7 |
| Conceptos cruzados sin owner claro | Fase 8 |
| Falta cobertura de tests en reports/salon/services/roles/reminders | Fase 9 |
| Falta guardrail de imports | Fase 9 |

## Que No Hacer

- No crear microservicios.
- No mover todo a `lib`.
- No crear carpetas `domain` o `use-cases` vacias por estetica.
- No introducir Interfaces abstractas si solo existe un Adapter y no hay variacion real.
- No duplicar reglas entre SQL y TypeScript sin documentar cual Implementation manda.
- No convertir Server Actions en mini repositorios.

## Primer Sprint Sugerido

Si se quiere empezar con bajo riesgo, el primer sprint puede ser:

1. Crear ADR de monolito modular.
2. Crear `docs/database-contracts.md`.
3. Eliminar/documentar carpetas vacias.
4. Extraer `features/reports/domain/metrics.ts`.
5. Agregar tests de metricas.
6. Dejar `reports/page.tsx` consumiendo el nuevo Module puro, aunque todavia no se haya movido todo el data Adapter.

Ese sprint da valor rapido sin tocar autenticacion, citas ni RLS.
