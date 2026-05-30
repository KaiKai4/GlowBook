# GlowBook Architecture Audit

Fecha: 2026-05-28

## Alcance

Este informe audita el proyecto `GlowBook_Proyect` carpeta por carpeta con foco en:

- Organizacion para monolito modular.
- Separacion de responsabilidades.
- SOLID y patrones de diseno pragmaticos.
- Deuda tecnica y modulos con poca Depth.
- Riesgos para seguridad multi-tenant, RBAC dinamico y reglas de agenda.

La auditoria usa el vocabulario de la skill `improve-codebase-architecture`:

- **Module**: cualquier pieza con Interface e Implementation.
- **Interface**: todo lo que un caller debe saber para usar un Module.
- **Implementation**: codigo interno del Module.
- **Depth**: leverage que entrega una Interface pequena sobre una Implementation rica.
- **Seam**: punto donde una Interface permite cambiar comportamiento.
- **Adapter**: implementacion concreta que satisface una Interface en un Seam.
- **Leverage**: valor que reciben callers y tests.
- **Locality**: cambios, bugs y conocimiento concentrados en un lugar.

## Resumen Ejecutivo

GlowBook ya esta orientado a un monolito modular con una estructura razonable:

```text
src/app        -> rutas, layouts, Server Actions y pantallas Next.js
src/features   -> modulos de dominio por area del negocio
src/lib        -> infraestructura compartida: auth, Supabase, utils, Result
src/components -> UI base y layout
supabase       -> schema, RLS, funciones, triggers y RPCs
docs/adr       -> decisiones arquitectonicas aceptadas
```

La arquitectura actual es buena para el tamano del proyecto. Mi evaluacion global es **7/10**.

Lo mas fuerte:

- El dominio esta documentado en `CONTEXT.md`.
- Hay ADRs claras para RLS, RBAC, appointment_items, archivado/reactivacion, invitaciones, eliminacion de salon, plantillas y tests.
- `features/appointments/domain` tiene Modules profundos y testeados.
- Supabase no es solo persistencia: actua como Adapter de seguridad con RLS, constraints, triggers y RPCs.
- `server-only` protege el Adapter `service_role`.

La friccion principal:

- Varias paginas en `src/app/(dashboard)` contienen queries, agregaciones, conversiones de zona horaria y reglas de permisos directamente. Eso reduce Locality.
- Algunas Server Actions todavia escriben directo a Supabase en vez de llamar use-cases.
- `features` mezcla Modules profundos con carpetas vacias o Modules muy shallow.
- Hay dependencias invertidas como `src/components/layout/feedback-bubble.tsx` importando una action desde `src/app`.
- El README raiz sigue siendo el default de Next.js y no refleja la arquitectura real.

## Arquitectura Actual

### Estilo

El proyecto usa un **monolito modular feature-first** sobre Next.js App Router:

- La capa de entrada vive en `src/app`.
- Los modulos de negocio viven en `src/features/<dominio>`.
- La persistencia y la seguridad de datos se concentran en Supabase.
- La UI compartida vive en `src/components`.
- Infraestructura transversal vive en `src/lib`.

### Regla de dependencia intencional

Segun `CLAUDE.md`, la regla esperada es:

```text
app -> use-cases -> domain + data
domain -> no Next, no Supabase, no React
```

Esa regla se cumple bien en algunos dominios, especialmente `appointments`, `customers` y `employees`, pero todavia no de forma consistente en `services`, `salon`, `notifications`, `roles`, `reports`, `recordatorios` y dashboard.

### Fuente de verdad de seguridad

La seguridad de tenant se apoya en:

- RLS en Supabase.
- `public.salon_id()`.
- `public.has_permission()`.
- `is_owner` como cortocircuito.
- `service_role` solo desde servidor.

Esto esta alineado con ADR 0001 y ADR 0003.

### Fuente de verdad de agenda

La agenda esta basada en:

- `appointments` como cabecera.
- `appointment_items` como verdad operacional.
- RPC `create_appointment`.
- Constraints de no overlap.
- Trigger `recalc_appointment`.

Esto esta alineado con ADR 0002.

## Auditoria Carpeta Por Carpeta

## Raiz: `GlowBook_Proyect/`

| Carpeta/archivo | Evaluacion |
|---|---|
| `.agents/` | Metadatos de skills del workspace. No es runtime. Bien separado. |
| `.claude/` | Configuracion de asistentes. No afecta la arquitectura de producto. |
| `glowbook/` | App principal. Es donde vive casi todo el sistema real. |
| `supabase/` | Contiene `.temp` con metadata de Supabase CLI. No es fuente de migraciones. |
| `skills-lock.json` | Lock de skills. Correcto fuera de la app. |

Recomendacion: mantener `glowbook/` como raiz operacional. La fuente real de migraciones es `glowbook/supabase/migrations`; la carpeta externa `supabase/.temp` se conserva como metadata de Supabase CLI.

## App Raiz: `glowbook/`

| Carpeta/archivo | Evaluacion |
|---|---|
| `package.json` | Stack claro: Next 16, React 19, Supabase, Tailwind, Zod, Vitest. Scripts utiles. |
| `tsconfig.json` | `strict: true` y alias `@/*`. Bien. |
| `eslint.config.mjs` | Configuracion base de Next. Correcta, pero sin reglas arquitectonicas. |
| `vitest.config.ts` | Configura alias `@` y stub de `server-only`. Bien. |
| `README.md` | Problema: sigue siendo el README generado por Next. No representa el producto ni la arquitectura. |
| `CONTEXT.md` | Muy bueno. Define el lenguaje del dominio y reglas que no deben romperse. |
| `CLAUDE.md` / `AGENTS.md` | Buen contrato arquitectonico. El codigo cumple parcialmente. |
| `.env.local*` | Correcto para configuracion local. No audite secretos. |
| `.next/`, `node_modules/` | Generados/dependencias. No deben auditarse como Implementation propia. |

Riesgo: el README desactualizado baja AI-navigability y onboarding humano. Para un monolito modular, el README deberia explicar los Modules principales, comandos, reglas de dependencia y flujo de datos.

Recomendacion: reemplazar README con una version de producto/arquitectura y agregar una seccion "Reglas de dependencia".

## `docs/adr/`

Estado: **fuerte**.

ADRs existentes:

- `0001-multi-tenant-rls.md`
- `0002-appointment-items-source-of-truth.md`
- `0003-dynamic-rbac-permissions.md`
- `0004-archive-reactivate-customers-collaborators.md`
- `0005-closed-onboarding-platform-invitations.md`
- `0006-delete-salon-through-transactional-rpc.md`
- `0007-notification-templates-operational-messages.md`
- `0008-tests-as-safety-net.md`

Lo bueno:

- Las decisiones cubren las zonas mas criticas: tenant, RBAC, citas, archivado, onboarding, eliminacion, plantillas y tests.
- `CONTEXT.md` y ADRs estan alineados.
- Las ADRs limitan refactors peligrosos. Por ejemplo, no conviene reabrir el modelo de `appointment_items`.

Friccion:

- Falta una ADR que describa la arquitectura modular en TypeScript: `app -> use-cases -> domain + data`.
- Falta documentar excepciones validas al uso de `service_role`, porque hoy se usa en plataforma, invitaciones y acceso de colaboradores.

Recomendacion: crear `0009-modular-monolith-feature-architecture.md` y, si se mantiene el patron actual, `0010-server-only-admin-adapter-exceptions.md`.

## `public/`

Estado: **limpio tras Fase 1**.

Los SVG default de Next (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) fueron verificados como no usados en codigo y eliminados. La carpeta `public/` tambien fue retirada al quedar vacia.

Recomendacion: recrear `public/` solo cuando existan assets reales de GlowBook.

## `scripts/`

Estado: **bueno**.

Archivo principal:

- `bootstrap-platform-admin.mjs`

Lo bueno:

- Resuelve el problema chicken-and-egg del primer superadmin.
- Usa `SUPABASE_SERVICE_ROLE_KEY` fuera del navegador.
- Es idempotente respecto a `platform_admins`.

Riesgos:

- `admin.auth.admin.listUsers()` puede no encontrar usuarios si crece el volumen y no se pagina con cuidado.
- El script vive fuera de `src/lib/supabase/admin.ts`, asi que duplica la creacion del Admin Adapter.

Recomendacion: mantenerlo como script operativo, pero documentarlo en README y considerar un helper compartido solo si aparecen mas scripts admin.

## `supabase/`

Estado: **fuerte, pero con alta responsabilidad**.

Contenido:

- `config.toml`
- `migrations/20240101000000_initial_schema.sql` hasta `20240101000022_drop_redundant_single_column_foreign_keys.sql`

Lo bueno:

- RLS habilitada en tablas de negocio.
- Helpers SQL para tenant y permisos.
- RPCs para flujos atomicos: invitacion, aceptacion, creacion de cita, eliminacion completa de salon.
- Triggers para campos derivados de citas.
- Constraints que protegen integridad tenant en asignaciones y appointment_items.
- Hay hardening incremental sobre `create_appointment`.

Riesgos:

- Las funciones SQL son Modules profundos, pero su Interface no esta resumida en docs. Para un cambio futuro, un developer debe leer muchas migraciones.
- Las migraciones contienen decisiones de dominio fuertes. Si no se documentan cerca de `features`, puede crecer una doble fuente de verdad entre TypeScript y SQL.
- `create_appointment` tiene reglas en SQL y tambien validaciones en `features/appointments`. Esta duplicacion es aceptable como defensa en profundidad, pero debe tratarse como duplicacion deliberada.

Recomendacion:

- Agregar `docs/database-contracts.md` con tabla de RPCs, triggers, constraints y que Module TypeScript depende de cada uno.
- Agregar tests de integracion selectivos para RLS cross-tenant y `create_appointment`, manteniendo ADR 0008.

## `src/app/`

Estado: **funcional, pero con exceso de Implementation en rutas**.

`src/app` cumple como entrada Next.js, pero varias rutas tienen demasiada Implementation de lectura, agregacion y reglas de negocio. La Interface de una pagina deberia ser principalmente: autenticar, autorizar, pedir un view model y renderizar.

### `src/app/layout.tsx` y `src/app/globals.css`

Estado: **aceptable**.

`layout.tsx` es pequeno. `globals.css` define tema visual y variables. No hay friccion fuerte.

### `src/app/proxy.ts`

Estado: **no observado en detalle**.

Existe como archivo raiz de routing/proxy. Conviene mantenerlo pequeno y evitar que absorba reglas de negocio.

### `src/app/api/`

Estado: **ligero**.

Contenido real:

- `api/auth/signout/route.ts`

Carpetas vacias:

- `api/webhooks`

La route de signout es simple. `api/webhooks` vacia deberia eliminarse o documentarse como placeholder si hay plan cercano.

### `src/app/(auth)/`

Estado: **aceptable con deuda menor**.

Subrutas:

- `login`
- `invite/[token]`
- `join/[token]`

Lo bueno:

- Los flujos de invitacion se conectan con use-cases de plataforma o actions especificas.
- Los formularios cliente estan aislados por ruta.

Friccion:

- `join/[token]/page.tsx` consulta con `createSupabaseAdminClient()` directamente desde la pagina server. Es server-only y no rompe seguridad, pero reduce Locality del flujo de invitacion de colaborador.
- `invite/[token]/page.tsx` y `join/[token]/join-form.tsx` usan Supabase browser para auth. Es razonable, pero la Interface del flujo queda repartida entre pagina, form y action.

Recomendacion: crear un Module de lectura para invitaciones de colaborador y de salon dentro de `features/platform` o `features/employees/use-cases`, para que las paginas solo pidan un view model.

### `src/app/(dashboard)/`

Estado: **mayor foco de mejora**.

Hay 60 archivos y unas 8000 lineas. Es la carpeta con mas Implementation del sistema.

Lo bueno:

- Las rutas estan organizadas por area del producto: appointments, customers, employees, roles, salon, services, reports, recordatorios, plantillas.
- Muchas Server Actions llaman use-cases.
- UI route-local para flujos grandes como wizard de citas es aceptable.

Riesgos globales:

- Hay queries Supabase directas en paginas como `page.tsx`, `appointments/page.tsx`, `reports/page.tsx`, `recordatorios/page.tsx`, `appointments/new/page.tsx`, `appointments/[id]/page.tsx`.
- Hay agregaciones y calculos de negocio en paginas: dashboard metrics, reports, calendarios, rangos por timezone, no-show rate, top services.
- Hay casts `as unknown as Parameters<...>` para adaptar datos a UI. Eso es senal de Interface poco estable entre data y UI.
- Algunas Server Actions escriben directo a repositorios o Supabase en vez de use-cases.

#### `src/app/(dashboard)/page.tsx`

Estado: **shallow page con Implementation pesada**.

Tiene queries, calculos de rango mensual, top services, pending confirmations, metric cards y render en un solo archivo de 333 lineas.

Recomendacion: extraer un Module `features/dashboard/use-cases/get-dashboard-overview.ts` o `features/reports/use-cases/get-dashboard-summary.ts`. La pagina deberia llamar una Interface pequena:

```text
getDashboardOverview(salonId, permissions)
```

No estoy proponiendo la Interface final todavia; el punto es crear un Seam de lectura con mas Depth.

#### `src/app/(dashboard)/appointments/`

Estado: **mixto**.

Lo bueno:

- `actions.ts` llama use-cases para crear, cancelar, confirmar y completar.
- El wizard tiene helpers testeados en `features/appointments/domain/wizard-availability.test.ts`.
- Usa `features/appointments/domain` para disponibilidad.

Friccion:

- `appointments/page.tsx` hace lectura y armado de calendario con Supabase directo.
- La pagina mezcla permisos, consulta de salon, empleados, business hours, plantilla de cancelacion, calculo de semana y rango UTC.
- `new/page.tsx` tambien consulta clientes, categorias, colaboradores y salon directo.
- La disponibilidad del wizard ya vive en `features/appointments/domain/wizard-availability.ts` desde Fase 8.

Recomendacion: crear Modules de lectura:

- Citas para calendario.
- Datos iniciales del wizard de cita.
- Detalle de cita.

Estos Modules deberian vivir en `features/appointments/use-cases` o en un submodulo `queries` si se decide separar comandos de lecturas.

#### `src/app/(dashboard)/customers/`

Estado: **bueno**.

Lo bueno:

- `actions.ts` llama use-cases: profile, lifecycle, duplicates, temporary.
- El archivado/reactivacion esta alineado con ADR 0004.
- La capa `app` se mantiene relativamente liviana.

Friccion:

- `customers/page.tsx` probablemente aun importa repo directo para listado. Eso es tolerable para lecturas simples, pero a futuro conviene un Module de view model.

Recomendacion: mantener como esta por ahora. Solo extraer cuando el listado crezca con filtros complejos o reglas nuevas.

#### `src/app/(dashboard)/employees/`

Estado: **bueno, con Module de acceso demasiado ancho**.

Lo bueno:

- `actions.ts` actua como orquestador de permisos, parseo y revalidacion.
- Use-cases separados: profile, lifecycle, access, schedule.
- Se respeta la regla de colaborador archivado y acceso revocado.

Friccion:

- `employee-access.ts` mezcla token, invitaciones, validacion de rol, Supabase Admin Auth, borrado de usuario y actualizacion de perfiles.
- `employees.repo.ts` tambien valida asignaciones y usa un Module de `features/services/domain`, creando acoplamiento inter-feature.

Recomendacion:

- Separar el Adapter de Auth Admin como Module explicito, server-only.
- Mantener `employee-access.ts` como use-case, pero empujar operaciones Supabase Admin repetidas a un Adapter.
- Evaluar si `validateEmployeeAssignments` pertenece a `features/employees` o a un Module compartido de "Asignacion de colaborador" en el lenguaje del dominio.

#### `src/app/(dashboard)/services/`

Estado: **aceptable, pero incompleto como feature modular**.

Lo bueno:

- `services.repo.ts` concentra CRUD del catalogo.
- Hay dominio testeado para integridad de asignacion.

Friccion:

- `features/services/use-cases` esta vacio.
- `services/actions.ts` llama `data/services.repo.ts` directo y mapea errores ahi.
- Eso hace que la Server Action tenga mas Implementation de la necesaria.

Recomendacion: crear use-cases para crear categoria, crear Servicio y actualizar Servicio. Las actions deberian parsear FormData, llamar use-case y revalidar.

#### `src/app/(dashboard)/salon/`

Estado: **necesita deepening**.

Lo bueno:

- `features/salon/schemas.ts` y `data/salon.repo.ts` existen.
- Hay validacion de temas, fondos y business hours.

Friccion:

- `salon/actions.ts` escribe directo con `createSupabaseServerClient()`.
- Las reglas de agenda del Salon quedan repartidas entre action, repo, `appointments/domain/availability` y paginas.
- `salon-settings.tsx` tiene 370 lineas, por encima de la regla local de evitar archivos mayores a 300 lineas.

Recomendacion: crear use-cases `updateSalonInfo`, `updateSalonTheme`, `updateSalonBackground`, `updateBusinessHours`. Dividir `salon-settings.tsx` por paneles internos.

#### `src/app/(dashboard)/roles/`

Estado: **aceptable, pero con Surface de permisos poco protegida**.

Lo bueno:

- Sigue RBAC dinamico.
- `roles.repo.ts` concentra lecturas y escrituras.

Friccion:

- No hay use-cases en `features/access/use-cases`; la carpeta esta vacia.
- `roles.repo.ts` acepta `permissionKeys: string[]`, no `Permission[]`, entonces la Interface permite valores fuera del catalogo TypeScript.
- Falta una capa que concentre errores de negocio: rol de sistema, permiso invalido, rol fuera del salon.

Recomendacion: mover operaciones de rol a use-cases y tipar permission keys con el catalogo de permisos.

#### `src/app/(dashboard)/plantillas/`

Estado: **aceptable, con oportunidad clara**.

Lo bueno:

- El dominio de plantillas (`features/notifications/domain/templates.ts`) es pequeno y testeado.
- Se cumple ADR 0007 para placeholders y fallback.

Friccion:

- `plantillas/actions.ts` llama el repo directo.
- Los eventos, nombres y reglas viven entre `schemas.ts`, `domain/templates.ts`, repo y UI.

Recomendacion: crear use-case `updateMessageTemplate`. Mantener el render como Module de dominio.

#### `src/app/(dashboard)/recordatorios/`

Estado: **pagina fina con lectura en Module de negocio desde Fase 8**.

Antes de Fase 8:

- `page.tsx` calcula rango de 7 dias, obtiene salon, citas, plantilla y empleados.
- El Module de recordatorio operativo no existe como `features/reminders`.

Resultado: `features/reminders/use-cases/get-reminder-queue.ts` owns la cola operativa. `features/notifications` conserva plantillas, placeholders y renderizado.

#### `src/app/(dashboard)/reports/`

Estado: **necesita deepening fuerte**.

`reports/page.tsx` contiene calculo de rango, queries, agregaciones de ingresos, no-show, breakdown por estado, colaborador y Servicio.

Problema:

- La pagina tiene Implementation de analitica.
- Es dificil testear sin renderizar una ruta Next.
- Cambios en metricas de negocio quedan lejos del dominio.

Recomendacion: crear `features/reports` con:

- schemas para filtros.
- use-case de reporte operacional.
- data Module para lecturas agregadas.
- tests de calculo puro para metricas.

#### `src/app/(dashboard)/feedback/`

Estado: **pequeno, pero con dependencia invertida desde layout**.

`src/components/layout/feedback-bubble.tsx` importa `submitFeedbackAction` desde `src/app/(dashboard)/feedback/actions`.

Problema:

- `components/layout` depende de `app`, cuando la direccion deseable es `app -> components`.
- Esto hace que un Module visual compartido conozca una ruta concreta.

Recomendacion: mover la accion de submit a `features/feedback/use-cases` y pasar el handler desde el layout, o crear un Adapter route-local sin que `components/layout` importe desde `app`.

### `src/app/(platform)/`

Estado: **bueno con riesgo de performance**.

Lo bueno:

- `layout.tsx` usa `requirePlatformAdmin`.
- Los repos usan `createSupabaseAdminClient()` desde servidor.
- La eliminacion completa delega a RPC transaccional, alineado con ADR 0006.

Friccion:

- `findSalonOverviews()` hace multiples queries por salon. Si hay muchos salones, sera N+1.
- `platform.repo.ts` mezcla lecturas de overview, invitaciones, eliminacion, feedback reports y estado de salon.

Recomendacion:

- Crear un read model SQL o RPC para `SalonOverview` si la plataforma crece.
- Dividir `platform.repo.ts` por responsabilidad: salons, invitations, feedback, destructive operations.

## `src/components/`

Estado: **bueno para UI base, con una inversion a corregir**.

### `src/components/ui/`

Archivos:

- `badge.tsx`
- `button.tsx`
- `card.tsx`
- `dialog.tsx`
- `input.tsx`
- `select.tsx`
- `textarea.tsx`

Evaluacion:

- UI atomica pequena.
- Depende de `cn`, `class-variance-authority` y React.
- Buena Locality para estilos base.

Riesgo:

- Si estos Modules empiezan a conocer dominio, perderan su valor.

Recomendacion: mantenerlos sin imports a `features` ni `app`.

### `src/components/layout/`

Archivos:

- `sidebar.tsx`
- `nav-items.ts`
- `feedback-bubble.tsx`
- `unsaved-changes.tsx`

Lo bueno:

- Navegacion y permisos estan concentrados.
- `unsaved-changes` es un Module transversal util.

Friccion:

- `feedback-bubble.tsx` depende de una Server Action ubicada en `src/app`.
- `nav-items.ts` importa permisos desde `lib/auth`, aceptable pero acopla UI de navegacion al catalogo de permisos.

Recomendacion: corregir la dependencia `components -> app`. El resto es aceptable.

## `src/features/`

Estado: **buena direccion, implementacion desigual**.

El patron esperado por dominio es:

```text
schemas.ts
domain/
data/
use-cases/
```

Esto esta bien como convencion, pero no todas las features tienen suficiente Implementation para justificar todas las carpetas. La regla de la skill aplica: **one Adapter = hypothetical seam, two Adapters = real seam**. No conviene crear seams vacios si aun no aportan Leverage.

### `src/features/access/`

Estado: **parcial**.

Contenido:

- `schemas.ts`
- `domain/permissions.ts`
- `data/roles.repo.ts`
- `use-cases/` vacio

Lo bueno:

- Permisos estan catalogados en dominio.
- Roles y permisos se leen desde DB.

Friccion:

- No hay use-cases; las rutas llaman repo directo.
- `roles.repo.ts` mezcla validacion, escritura y lectura.
- `permissionKeys` es `string[]`, lo que debilita la Interface.

Recomendacion: crear use-cases de roles y hacer que `roles.repo.ts` sea un Adapter de persistencia mas estrecho.

### `src/features/appointments/`

Estado: **el modulo mas fuerte**.

Contenido:

- `schemas.ts`
- `domain/availability.ts`
- `domain/lifecycle.ts`
- `domain/scheduling.ts`
- `domain/types.ts`
- `data/appointments.repo.ts`
- use-cases para disponibilidad, creacion, confirmacion, cancelacion, completado.
- tests de dominio y una prueba RPC.

Lo bueno:

- Buen Depth en dominio.
- Tests cruzan Interfaces utiles.
- Respeta appointment_items como fuente de verdad.
- DB y TypeScript se complementan para defensa en profundidad.

Friccion:

- `create-appointment.ts` usa Supabase directo y tambien usa repo, mezclando Adapter y use-case.
- Lecturas para calendario siguen en `app`.
- La disponibilidad del wizard tiene parte en `app`.

Recomendacion: mantener la forma de dominio, pero profundizar los use-cases de lectura y separar el Adapter de creacion de cita.

### `src/features/customers/`

Estado: **bueno**.

Contenido:

- `schemas.ts`
- `data/customers.repo.ts`
- use-cases para duplicados, lifecycle, profile y temporary.
- `domain/` vacio.

Lo bueno:

- Buen uso de use-cases.
- Respeta archivado/reactivacion.
- Temporary customer esta nombrado como concepto real.

Friccion:

- `domain/` esta vacio. No hace dano, pero es ruido.
- Duplicados y reglas de reactivacion pueden merecer un Module de dominio si crecen.

Recomendacion: dejar asi por ahora o eliminar carpeta vacia si no hay regla pura. No crear abstraccion prematura.

### `src/features/employees/`

Estado: **bueno, con acoplamiento alto en acceso**.

Contenido:

- `schemas.ts`
- `data/employees.repo.ts`
- use-cases de profile, lifecycle, access y schedule.
- `domain/` vacio.
- tests de access y lifecycle.

Lo bueno:

- Buen intento de separar flujos.
- Acceso, archivado y horarios tienen Modules propios.
- Tests cubren riesgos importantes.

Friccion:

- `employee-access.ts` tiene muchas responsabilidades.
- `employee-profile.ts` tambien toca Admin Auth cuando cambia email.
- `employees.repo.ts` valida asignaciones importando dominio de `services`.

Recomendacion: crear un Adapter server-only para Auth Admin y decidir donde vive el concepto "Asignacion de colaborador". Probablemente merece un Module compartido dentro de `features/services` o un Module de dominio en `features/employees`, pero no ambos.

### `src/features/feedback/`

Estado: **demasiado shallow**.

Contenido:

- `schemas.ts`
- `data/feedback.repo.ts`

Lo bueno:

- Es pequeno y claro.

Friccion:

- No hay use-case; el layout llama una action en `app`.
- Si soporte crece, faltara un Module que concentre validacion, status y visibilidad.

Recomendacion: crear `use-cases/submit-feedback.ts` y corregir dependencia desde layout.

### `src/features/notifications/`

Estado: **bueno en dominio, incompleto en orquestacion**.

Contenido:

- `schemas.ts`
- `domain/templates.ts`
- `data/notification-templates.repo.ts`

Lo bueno:

- Plantillas y placeholders estan concentrados.
- Hay fallback por defecto.
- Tiene tests para render.

Friccion:

- No hay use-cases para actualizar o resolver plantilla activa.
- Recordatorios ya viven en `features/reminders` como Module de negocio.

Recomendacion: crear use-cases de plantilla y mantener `features/reminders` como owner del flujo operativo.

### `src/features/platform/`

Estado: **funcional, pero repo demasiado ancho**.

Contenido:

- `data/platform.repo.ts`
- use-cases `invite-salon.ts`, `accept-invitation.ts`

Lo bueno:

- Operaciones cross-tenant estan server-only.
- Aceptacion de invitacion usa Admin Adapter y RPC.
- Eliminacion de salon sigue ADR 0006.

Friccion:

- `platform.repo.ts` tiene muchas razones para cambiar.
- `invite-salon.ts` valida admin internamente y recibe FormData, mezclando capa route con use-case.

Recomendacion: hacer que use-cases reciban input tipado, no FormData. Mantener FormData en Server Actions.

### `src/features/salon/`

Estado: **parcial**.

Contenido:

- `schemas.ts`
- `data/salon.repo.ts`

Lo bueno:

- Configuracion de Salon tiene schema.
- Repos de lectura existen.

Friccion:

- No hay use-cases para cambios de configuracion.
- `salon/actions.ts` escribe directo a Supabase.
- Business hours afectan disponibilidad de citas, pero no hay un Module que lo explicite.

Recomendacion: crear use-cases de configuracion de Salon y tests para horario del Salon si se vuelve mas complejo.

### `src/features/services/`

Estado: **parcial**.

Contenido:

- `schemas.ts`
- `data/services.repo.ts`
- `use-cases/`

Lo bueno:

- El repo valida categoria activa al crear/actualizar Servicio.

Friccion:

- Las actions saltan directo a repo.
- El concepto "Asignacion de colaborador" cruza `services`, `employees` y `appointments`.

Resultado Fase 8: la regla de asignacion vive en `features/employees/domain/collaborator-assignment.ts`; `services` conserva el catalogo.

## `src/lib/`

Estado: **bueno, con oportunidad de endurecer Interfaces**.

### `src/lib/supabase/`

Archivos:

- `server.ts`
- `client.ts`
- `admin.ts`

Lo bueno:

- `server-only` protege server/admin.
- Browser client solo usa anon key.
- Admin Adapter esta aislado.

Friccion:

- Muchos repos y use-cases crean clients directamente. Eso hace que tests deban mockear factories globales.

Recomendacion: a futuro, permitir inyectar Adapter en use-cases criticos. No hacerlo masivamente todavia; empezar por Modules con tests dificiles.

### `src/lib/auth/`

Archivos:

- `session.ts`
- `permissions.ts`

Lo bueno:

- `hasPermission` y `getPermissions` centralizan RBAC.
- `requireActiveProfile` valida salon activo.

Friccion:

- `session.ts` mezcla lectura de profile, redirect de Next, verificacion de salon e isPlatformAdmin.
- `permissions.ts` duplica catalogo con DB, lo cual esta aceptado por ADR 0003 pero necesita sincronizacion.

Recomendacion: mantener por ahora, pero si auth crece, separar read model de Profile y helpers Next redirect.

### `src/lib/utils/`

Estado: **bueno**.

`dates.ts`, `phone.ts`, `cn.ts` son transversales. Hay test para phone. Las funciones de fechas son muy usadas y criticas para agenda/reportes.

Recomendacion: ampliar tests de timezone en `dates.ts` porque varias pantallas dependen de esos calculos.

### `src/lib/validation/`

Estado: **bueno**.

`name.ts` es un Module pequeno y reusable. Correcto.

### `src/lib/result.ts`

Estado: **bueno**.

`Result` da una Interface consistente para Server Actions y use-cases. Buen Leverage.

## `src/types/`

Estado: **correcto**.

Archivos:

- `database.types.ts`
- `app.types.ts`

`database.types.ts` es generado y grande, no debe editarse manualmente. `app.types.ts` debe seguir siendo pequeno y no convertirse en cajon de tipos globales.

Recomendacion: mantener los tipos especificos cerca de cada feature cuando pertenezcan al dominio.

## `src/test/`

Estado: **correcto**.

Contiene:

- `server-only.ts`

Sirve para Vitest. Bien aislado.

## Tests Existentes

Pruebas detectadas:

- `src/features/appointments/domain/availability.test.ts`
- `src/features/appointments/domain/lifecycle.test.ts`
- `src/features/appointments/domain/scheduling.test.ts`
- `src/features/appointments/use-cases/create-appointment.rpc.test.ts`
- `src/features/employees/use-cases/employee-access.test.ts`
- `src/features/employees/use-cases/employee-lifecycle.test.ts`
- `src/features/employees/domain/collaborator-assignment.test.ts`
- `src/features/notifications/domain/templates.test.ts`
- `src/features/appointments/domain/wizard-availability.test.ts`
- `src/features/reminders/use-cases/get-reminder-queue.test.ts`
- `src/features/salon/use-cases/update-business-hours.test.ts`
- `src/lib/utils/dates.test.ts`
- `src/lib/auth/session.test.ts`
- `src/lib/utils/phone.test.ts`

Evaluacion:

- Buena cobertura en Modules criticos de dominio.
- Falta cobertura para reports, dashboard metrics, salon business hours actions, roles, services use-cases y RLS cross-tenant.

## Hallazgos Principales

### 1. `src/app` contiene demasiada Implementation de negocio

Se ve en:

- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/reports/page.tsx`
- `src/app/(dashboard)/recordatorios/page.tsx`
- `src/app/(dashboard)/appointments/page.tsx`
- `src/app/(dashboard)/appointments/new/page.tsx`

Problema:

- Baja Locality.
- Tests tienen que cruzar demasiada UI o Next runtime.
- Cada pantalla conoce demasiadas tablas.

Recomendacion strength: **Strong**.

### 2. Server Actions no son consistentes

Buenas:

- `appointments/actions.ts` llama use-cases.
- `customers/actions.ts` llama use-cases.
- `employees/actions.ts` llama use-cases.

Debiles:

- `services/actions.ts` llama repos directo.
- `salon/actions.ts` usa Supabase directo.
- `plantillas/actions.ts` llama repo directo.
- `roles/actions.ts` llama repo directo.

Problema:

- Las actions se vuelven Interfaces publicas con Implementation interna.
- Se rompe Single Responsibility: parseo + auth + negocio + persistencia + revalidacion.

Recomendacion strength: **Strong**.

### 3. Carpetas vacias generan senales falsas

Carpetas vacias:

- `src/app/(platform)/admin/invitations`
- `src/app/api/webhooks`
- `src/features/access/use-cases`
- `src/features/customers/domain`
- `src/features/employees/domain`
- `src/features/services/use-cases`

Problema:

- Reducen AI-navigability.
- Sugieren seams que aun no existen.

Recomendacion strength: **Worth exploring**.

### 4. Dependencia invertida `components -> app`

Archivo:

- `src/components/layout/feedback-bubble.tsx`

Importa:

- `@/app/(dashboard)/feedback/actions`

Problema:

- `components/layout` deberia ser reusable y no conocer rutas.
- Este acoplamiento dificulta mover feedback o testear layout.

Recomendacion strength: **Strong**.

### 5. `features/platform/data/platform.repo.ts` tiene demasiadas razones para cambiar

Contiene:

- lectura de salones.
- overview de salones.
- invitaciones.
- activar/desactivar salon.
- eliminacion completa.
- feedback reports.

Problema:

- Interface amplia y con Implementation heterogenea.
- N+1 potencial en `findSalonOverviews`.

Recomendacion strength: **Worth exploring**.

### 6. Uso de `service_role` necesita contrato explicito

El uso actual parece server-only, pero ocurre en:

- plataforma.
- aceptacion de invitacion.
- acceso de colaboradores.
- session/isPlatformAdmin.

Problema:

- ADR 0001 enfatiza plataforma cross-tenant, pero el codigo usa Admin Adapter en mas flujos.
- Puede estar bien, pero debe quedar como decision aceptada.

Recomendacion strength: **Worth exploring**.

## Recomendaciones Priorizadas

### Prioridad 1: Crear Modules de lectura para dashboard, reports, reminders y appointments

Objetivo:

- Sacar queries y agregaciones de paginas.
- Aumentar Depth de `features`.
- Hacer testeables metricas y reglas de fecha.

Primeros candidatos:

- `features/reports/use-cases/get-operational-report.ts`
- `features/appointments/use-cases/get-calendar-view.ts`
- `features/reminders/use-cases/get-reminder-queue.ts`
- `features/dashboard/use-cases/get-dashboard-overview.ts`

No conviene disenar todas las Interfaces al mismo tiempo. Empezaria por reports porque hoy concentra muchas reglas y no tiene feature propia.

### Prioridad 2: Normalizar Server Actions

Regla propuesta:

```text
Server Action = require profile + permission + parse FormData + call use-case + revalidate
```

No deberia:

- construir queries Supabase.
- mapear errores SQL complejos.
- decidir reglas del dominio.

Aplicar primero en:

- `services/actions.ts`
- `salon/actions.ts`
- `plantillas/actions.ts`
- `roles/actions.ts`

### Prioridad 3: Corregir dependency direction en feedback

Cambiar:

```text
components/layout/feedback-bubble -> app/(dashboard)/feedback/actions
```

Por:

```text
app/layout o dashboard/layout -> pasa action/handler
features/feedback/use-cases -> submit feedback
components/layout/feedback-bubble -> UI pura
```

### Prioridad 4: Documentar arquitectura modular en ADR

Crear una ADR para:

- capas permitidas.
- direccion de imports.
- cuando crear `domain`, `data`, `use-cases`.
- cuando una carpeta vacia se elimina.
- excepciones server-only.

### Prioridad 5: Limpiar placeholders y assets default

Eliminar o documentar:

- `src/app/api/webhooks`
- `src/app/(platform)/admin/invitations`
- carpetas `domain/use-cases` vacias si no hay plan inmediato.
- SVGs default de Next en `public`.

## Propuesta De Estructura Objetivo

Sin hacer un refactor masivo, la direccion mas sana seria:

```text
src/
  app/
    (auth)/
    (dashboard)/
    (platform)/
    api/
  components/
    ui/
    layout/
  features/
    access/
      domain/
      data/
      use-cases/
    appointments/
      domain/
      data/
      use-cases/
      queries/          # opcional si se separan lecturas complejas
    customers/
      data/
      use-cases/
    employees/
      data/
      use-cases/
    feedback/
      data/
      use-cases/
    notifications/
      domain/
      data/
      use-cases/
    reports/
      domain/
      data/
      use-cases/
    salon/
      data/
      use-cases/
    services/
      domain/
      data/
      use-cases/
  lib/
    auth/
    supabase/
    utils/
    validation/
  types/
  test/
```

Nota: `queries/` es opcional. Si se usa, debe tener una razon clara: separar read models complejos de comandos mutables. Si no, mantener todo en `use-cases`.

## Evaluacion SOLID

### Single Responsibility

Cumple en:

- `features/appointments/domain/*`
- `features/notifications/domain/templates.ts`
- `lib/result.ts`
- UI base en `components/ui`

Debe mejorar en:

- `reports/page.tsx`
- `dashboard/page.tsx`
- `platform.repo.ts`
- `employee-access.ts`
- `salon/actions.ts`

### Open/Closed

Cumple parcialmente:

- RBAC permite agregar roles sin cambiar codigo.
- Plantillas permiten cambiar mensajes sin redeploy.

Debe mejorar:

- Nuevos reportes o metricas hoy implican tocar paginas grandes.
- Nuevos eventos de notificacion requieren tocar schema, dominio, repo y UI.

### Liskov Substitution

No aplica de forma fuerte porque el proyecto no usa jerarquias OO. La sustitucion relevante aqui seria por Adapters. Hoy hay pocos seams con multiples Adapters.

### Interface Segregation

Cumple en:

- UI atoms.
- Result.
- algunos use-cases.

Debe mejorar:

- `platform.repo.ts` tiene Interface demasiado amplia.
- `employees.repo.ts` expone lecturas, escrituras, schedule e invitation rows.

### Dependency Inversion

Cumple parcialmente:

- El dominio puro no importa Next ni Supabase en appointments.
- `server-only` protege Supabase admin.

Debe mejorar:

- Muchos use-cases crean Supabase client directamente.
- `components/layout` importa desde `app`.
- Server Actions a veces dependen de data Adapters directos.

## Top Recommendation

La primera mejora que haria es extraer `src/app/(dashboard)/reports/page.tsx` hacia `features/reports`.

Por que primero:

- Es una pantalla con mucha logica de negocio y agregacion.
- No tiene feature propia.
- Es testeable sin tocar UI si se separan calculos.
- Reduce rapido el peso de `src/app`.
- Crea un patron replicable para dashboard, reminders y calendar.

Secuencia sugerida:

1. Crear `features/reports/schemas.ts` para filtros de periodo.
2. Crear un Module puro para agregaciones: revenue, avg ticket, no-show, breakdowns.
3. Crear un data Module para traer appointments/items/customers.
4. Crear un use-case que componga input + data + dominio.
5. Dejar la pagina como auth + permission + use-case + render.
6. Agregar tests del Module de agregacion.

## Conclusion

GlowBook no necesita cambiar a microservicios ni a una arquitectura mas pesada. La direccion correcta es profundizar el monolito modular que ya existe.

La base es sana: dominio documentado, ADRs, RLS, RBAC, tests y features separadas. El trabajo importante ahora es mover Implementation fuera de rutas grandes hacia Modules con mas Depth, corregir dependencias invertidas y eliminar seams vacios que no aportan Leverage.

Si se siguen las recomendaciones por prioridad, el proyecto puede crecer con buena Locality, menos deuda tecnica y mejor alineacion con SOLID sin perder la velocidad del monolito.
