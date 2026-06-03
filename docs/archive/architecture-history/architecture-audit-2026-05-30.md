# Auditoria De Arquitectura - GlowBook

Fecha: 2026-05-30

## Objetivo

Auditar el proyecto carpeta por carpeta usando el criterio de la skill
`improve-codebase-architecture`: buscar modulos profundos, limites claros,
interfaces estables, buena localidad del cambio y una organizacion que sostenga
un monolito modular sin crear deuda tecnica innecesaria.

El objetivo arquitectonico declarado para GlowBook es:

- mantener un monolito modular por feature;
- separar rutas, casos de uso, dominio y acceso a datos;
- proteger aislamiento multi-tenant con Supabase/RLS;
- evitar que `src/app` se convierta en la capa de negocio;
- evitar que `service_role` o Supabase Admin se filtren fuera de adaptadores
  autorizados;
- sostener principios SOLID sin sobrediseniar el proyecto.

## Evidencia Revisada

- `CONTEXT.md`
- `docs/database-contracts.md`
- ADRs `0001` a `0010`, especialmente:
  - `0001-multi-tenant-rls.md`
  - `0002-appointment-items-source-of-truth.md`
  - `0008-tests-as-safety-net.md`
  - `0009-modular-monolith-feature-architecture.md`
  - `0010-server-only-admin-adapter-exceptions.md`
- `scripts/check-architecture.mjs`
- estructura completa de `src/app`, `src/components`, `src/features`,
  `src/lib`, `src/types`, `src/test`, `supabase`, `scripts` y `docs`
- imports reales entre `app`, `components`, `features` y `lib/supabase`
- uso real de `createSupabaseServerClient` y `createSupabaseAdminClient`

Validaciones ejecutadas durante esta auditoria:

```text
npm.cmd run architecture:check
Architecture guardrails passed.

npm.cmd run test
42 test files passed, 1 skipped
121 tests passed, 2 skipped

npm.cmd run type-check
OK
```

Tambien se verifico con busquedas de imports que:

- `src/app` no importa `src/features/*/data` directamente.
- `src/components` y `src/features` no importan `@/app`.
- `createSupabaseAdminClient` esta restringido por guardrail a adaptadores
  autorizados.
- `features/*/domain` no importa Next, React, Supabase ni `server-only`.

## Veredicto Ejecutivo

Estado actual: bueno y bastante alineado con monolito modular.

Calificacion arquitectonica aproximada: 8.3/10.

GlowBook ya no se ve como una aplicacion organizada solo por rutas de Next.js.
La arquitectura actual se apoya en `src/features` como nucleo del dominio y
usa `src/app` principalmente como capa de entrega. Esto es el cambio correcto
para el objetivo de monolito modular.

Lo mejor implementado:

- `src/features` concentra los modulos de negocio por dominio.
- `src/app` consume use-cases, schemas y view-models, no repositorios.
- Supabase server client vive principalmente en `features/*/data`.
- `service_role` esta protegido con `server-only` y guardrails.
- Citas es un modulo profundo: dominio puro, use-cases, data adapters y tests.
- Reportes ya calcula metricas desde `appointment_items`, respetando el ADR 0002.
- Hay guardrails ejecutables para bloquear regresiones arquitectonicas.
- La suite de tests cubre reglas criticas del dominio.

Los principales riesgos restantes:

- algunos use-cases todavia llaman helpers privilegiados de Supabase Auth
  (`auth-admin`) directamente. No es una fuga al cliente, pero reduce la
  separacion estricta entre orquestacion y adaptadores externos.
- `src/app` todavia contiene muchos componentes de UI especificos de pantalla.
  Esto no es incorrecto por si mismo, pero hay que vigilar que no acumulen
  reglas de negocio.
- algunos modulos pequenos no tienen `domain/`. Eso esta bien mientras no haya
  reglas puras relevantes, pero si crecen, las reglas deberian salir de
  `use-cases`.
- `src/lib/auth/session.ts` concentra sesion, tenant activo y validacion de
  plataforma. Es util ahora, pero puede volverse un modulo demasiado profundo
  con demasiadas responsabilidades.

## Arquitectura Actual

La arquitectura vigente es:

```text
src/app
  -> capa de entrega Next.js App Router
  -> pages, layouts, route handlers y server actions
  -> valida sesion, permisos, parsing de form/search params y revalidacion

src/features/<feature>
  -> modulo de negocio
  -> schemas.ts para contratos de entrada
  -> domain/ para reglas puras
  -> data/ para Supabase/Postgres
  -> use-cases/ para orquestacion
  -> view-models.ts cuando una lectura necesita forma estable para UI

src/components
  -> componentes compartidos
  -> ui/ debe ser libre de dominio
  -> layout/ puede importar interfaces estables de features para navegacion/chrome

src/lib
  -> infraestructura compartida
  -> auth, supabase, utilidades, validacion comun y Result

supabase/migrations
  -> contrato final de seguridad, RLS, constraints, triggers y RPCs
```

Flujo deseado y mayormente cumplido:

```text
src/app -> features/*/use-cases -> features/*/domain + features/*/data -> Supabase
```

Regla importante: `src/app` puede saber que existe un caso de uso, pero no debe
conocer la forma de una query, un RPC, un join de Supabase ni un cliente admin.

## Auditoria Carpeta Por Carpeta

## Raiz Del Proyecto

Carpetas y archivos relevantes:

- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `eslint.config.mjs`
- `postcss.config.mjs`
- `vitest.config.ts`
- `.env.local.example`
- `README.md`
- `CONTEXT.md`

Responsabilidad:

Configurar el stack base: Next.js 16, React 19, TypeScript, Tailwind,
Supabase, ESLint y Vitest.

Estado:

Bien organizada. Los scripts importantes existen y son coherentes:

- `dev`
- `build`
- `lint`
- `architecture:check`
- `test`
- `type-check`
- `db:types`
- `db:migrate`
- `bootstrap:admin`

Evaluacion:

La raiz no esta contaminada con logica de negocio. `CONTEXT.md` cumple un rol
valioso como glosario de dominio y reglas que no deben romperse.

Mejoras recomendadas:

- asegurar que CI ejecute siempre `npm run lint`, `npm run test`,
  `npm run type-check` y `npm run build`;
- documentar en `README.md` el flujo minimo para nuevos cambios:
  migraciones, tipos generados, tests y guardrails.

## `.agents`

Responsabilidad:

Contener skills o herramientas locales de agentes.

Estado:

No forma parte del runtime del producto. Es soporte de desarrollo.

Evaluacion:

Correcto mientras no se mezcle con codigo productivo.

Mejoras recomendadas:

- mantenerlo fuera de decisiones de dominio;
- no referenciar rutas de `.agents` desde `src`.

## `.next` y `node_modules`

Responsabilidad:

Artefactos generados por Next.js y dependencias instaladas.

Estado:

No deben auditarse como arquitectura fuente.

Evaluacion:

Correcto que no formen parte del diseno del sistema.

Mejoras recomendadas:

- confirmar que permanecen ignorados por git;
- no basar decisiones arquitectonicas en archivos generados.

## `docs`

Responsabilidad:

Explicar decisiones, contratos, auditorias y fases arquitectonicas vigentes.

Estado:

Muy valioso para evitar que el monolito modular dependa solo de memoria
individual. Existen:

- auditoria vigente;
- fases vigentes;
- contratos de base de datos;
- ADRs;
- runbooks y checklist operativos.

Nota 2026-05-31:

Las auditorias y roadmaps reemplazados por el corte del 2026-05-30 fueron
retirados de `docs/` para evitar deriva documental. El historial git conserva
ese contexto si se necesita consultar.

Evaluacion:

Fuerte. `docs/database-contracts.md` es especialmente importante porque mapea
que regla vive en SQL y que regla vive en TypeScript.

Riesgo:

Puede crecer como historial duplicado. Como ya hubo documentos anteriores, el
riesgo no es tener muchos `.md`, sino no saber cual es el vigente.

Mejoras recomendadas:

- declarar en `docs/README.md` cual documento es la auditoria vigente;
- no borrar auditorias importantes sin leerlas primero;
- retirar o archivar documentos reemplazados cuando ya no describan el estado
  actual del proyecto.

## `docs/adr`

Responsabilidad:

Registrar decisiones arquitectonicas estables.

Estado:

Muy bien orientado. Los ADRs cubren:

- aislamiento multi-tenant con RLS;
- `appointment_items` como fuente de verdad;
- RBAC dinamico;
- archivado/reactivacion;
- invitaciones de plataforma;
- borrado transaccional de salon;
- plantillas de notificacion;
- tests como red de seguridad;
- arquitectura de features;
- excepciones admin/server-only.

Evaluacion:

Es una de las partes mas sanas del proyecto. Los ADRs ya funcionan como
contrato para el guardrail `scripts/check-architecture.mjs`.

Mejoras recomendadas:

- mantener ADR 0009 como fuente de verdad para estructura de modulos;
- si se decide permitir use-cases que llamen `auth-admin`, documentarlo mejor
  en ADR 0010 o extraerlo a adapters de data para no aumentar excepciones
  implicitas.

## `scripts`

Responsabilidad:

Automatizar guardrails y tareas operativas.

Archivos clave:

- `scripts/check-architecture.mjs`
- `scripts/bootstrap-platform-admin.mjs`

Estado:

`check-architecture.mjs` es un guardrail real, no solo documentacion. Bloquea:

- carpetas vacias en features;
- imports desde `components` hacia `app`;
- imports tecnologicos desde `features/*/domain`;
- uso de `createSupabaseAdminClient` fuera de adaptadores autorizados;
- imports directos desde `src/app` hacia `features/*/data`.

Tambien avisa si un use-case importa `@/lib/supabase/server`, empujando el
acceso a datos hacia `data/`.

Evaluacion:

Muy buena pieza arquitectonica. Convierte la intencion del monolito modular en
una restriccion ejecutable.

Mejoras recomendadas:

- convertir warnings importantes en errores cuando el equipo este listo;
- agregar una regla opcional para detectar imports desde `features/*/use-cases`
  hacia `@/lib/supabase/auth-admin`, o documentar explicitamente esas
  excepciones;
- ejecutar `architecture:check` en CI.

## `supabase`

Responsabilidad:

Ser la autoridad final de seguridad, integridad y persistencia.

Carpetas clave:

- `supabase/migrations`
- `supabase/.temp` como artefacto local

Estado:

La base de datos esta tratada como parte central de la arquitectura, no como un
detalle secundario. Las migraciones cubren:

- schema inicial;
- RLS y funciones;
- seed RBAC;
- RPC de creacion de citas;
- hooks de auth;
- proteccion de privilegios;
- invitaciones;
- politicas de citas;
- feedback;
- tema visual del salon;
- borrado completo de salon;
- constraints de integridad por tenant;
- features deshabilitadas por salon;
- read model de plataforma.

Evaluacion:

Correcto para un SaaS multi-tenant. SQL/RLS/RPC mantiene la autoridad final
donde corresponde: seguridad y consistencia de datos.

Riesgos:

- cualquier cambio de schema debe actualizar `src/types/database.types.ts`;
- cualquier regla duplicada en TypeScript debe dejar claro si SQL o TS es la
  autoridad final;
- los RPCs criticos necesitan pruebas/manual checks porque protegen datos de
  alto impacto.

Mejoras recomendadas:

- seguir usando `docs/database-contracts.md` como mapa de ownership;
- agregar checklist obligatorio al cambiar RLS/RPC/triggers;
- mantener tests o validaciones manuales para isolation multi-tenant.

## `src/app`

Responsabilidad:

Capa de entrega de Next.js App Router.

Debe encargarse de:

- rutas;
- layouts;
- pages;
- route handlers;
- server actions;
- lectura de `searchParams`;
- parsing de `FormData`;
- sesion y permisos de entrada;
- `revalidatePath`;
- renderizado.

No debe encargarse de:

- queries complejas;
- reglas de negocio profundas;
- calculo de metricas;
- acceso directo a repositorios `features/*/data`;
- uso de `service_role`.

Estado:

Bueno. Las busquedas de imports muestran que `src/app` consume
`features/*/use-cases`, `features/*/schemas`, `features/*/domain` puro y
`view-models`, pero no `features/*/data`.

### `src/app/(auth)`

Responsabilidad:

Login, aceptacion de invitaciones de salon y union de colaboradores.

Estado:

Correcto. Usa Supabase browser client en pantallas de auth y delega acciones
de invitaciones a use-cases.

Riesgo:

Los flujos de invitacion mezclan Auth externo, perfiles y tenant. Son sensibles
y deben conservar tests.

Mejoras recomendadas:

- mantener rollback de Auth en use-cases/adapters;
- evitar meter queries nuevas en pages/actions.

### `src/app/(dashboard)`

Responsabilidad:

Experiencia operativa del salon: citas, clientes, colaboradores, servicios,
roles, plantillas, recordatorios, reportes y configuracion.

Estado:

Bueno. La mayoria de actions y pages son adaptadores de entrega. Ejemplo:
`appointments/actions.ts` valida perfil, permisos, parsea formulario, llama
use-cases y revalida rutas.

Riesgo:

Hay muchos componentes route-local dentro de `src/app`. Esto es aceptable si
son componentes de presentacion especificos de pantalla, pero puede degradarse
si empiezan a acumular reglas de negocio.

Mejoras recomendadas:

- dejar componentes en `src/app` mientras sean UI local de ruta;
- extraer a `features/<feature>/components` solo si una pieza se reutiliza,
  crece mucho o empieza a conocer reglas del dominio;
- no mover por mover: carpetas vacias o capas artificiales generan deuda.

### `src/app/(dashboard)/reports`

Responsabilidad:

Pantalla de reportes operativos del salon.

Estado:

Correcto. `page.tsx` parsea filtros y permisos, luego llama
`getOperationalReport`. La logica de periodo, metricas y queries vive en
`src/features/reports`.

Evaluacion:

Buen ejemplo del objetivo de la fase de modularizacion: la ruta sigue existiendo
en `src/app`, pero el modulo de negocio no vive ahi.

### `src/app/(platform)`

Responsabilidad:

Administracion de plataforma: invitaciones, salones, reports de feedback,
features deshabilitadas y borrado de salon.

Estado:

Correcto. Las acciones llaman `requirePlatformAdmin` y delegan en
`src/features/platform/use-cases`.

Riesgo:

Es la zona con mas privilegio del sistema. Todo cambio aqui debe tener mas
cuidado que una pantalla tenant normal.

Mejoras recomendadas:

- mantener `service_role` solo en data adapters autorizados;
- agregar tests para cada caso de uso de plataforma que toque datos
  irreversibles.

### `src/app/api`

Responsabilidad:

Route handlers puntuales.

Estado:

Actualmente existe `api/auth/signout`, que usa Supabase server client para
cerrar sesion. Es una excepcion razonable porque pertenece a auth delivery.

Mejoras recomendadas:

- si aparecen APIs de negocio, deben llamar use-cases, no repositorios.

## `src/components`

Responsabilidad:

Componentes compartidos entre rutas.

### `src/components/ui`

Responsabilidad:

Design system base: `button`, `input`, `select`, `dialog`, `card`, `badge`,
`textarea`.

Estado:

Sano. No depende de dominio ni de Supabase. Usa utilidades compartidas como
`cn` y variantes de `class-variance-authority`.

Evaluacion:

Correcto para SRP: componentes atomicos, reutilizables y sin reglas de negocio.

Mejoras recomendadas:

- mantener `ui/` completamente libre de features;
- evitar que componentes base conozcan permisos, salon, citas o Supabase.

### `src/components/layout`

Responsabilidad:

Chrome global: sidebar, navegacion, cambios sin guardar y feedback bubble.

Estado:

Bueno con excepcion documentada. `nav-items.ts` importa tipos y funciones puras
de `features/salon/domain/salon-features` para ocultar features deshabilitadas.
Esto coincide con ADR 0009: layout puede importar interfaces estables de
features para navegacion/chrome.

Riesgo:

`feedback-bubble` importa schemas de `features/feedback`. Es aceptable porque
es UI global de feedback, pero debe mantenerse como frontera ligera.

Mejoras recomendadas:

- si feedback crece, mover paneles especificos a `features/feedback/components`
  y dejar en `layout` solo el montaje global;
- layout no debe importar `features/*/data` ni use-cases con IO directo.

## `src/features`

Responsabilidad:

Ser el nucleo del monolito modular. Cada carpeta representa un modulo de
producto o negocio.

Regla sana:

Un feature no necesita tener todas las capas si no las necesita. Es mejor un
modulo pequeno y honesto que una arquitectura inflada con carpetas vacias.

### `src/features/access`

Responsabilidad:

RBAC dinamico: roles, permisos, asignacion de roles y pantalla de roles.

Estructura:

- `schemas.ts`
- `domain/permissions.ts`
- `data/roles.repo.ts`
- `use-cases/*`

Estado:

Bueno. El catalogo de permisos esta separado como dominio y los casos de uso
orquestan cambios.

Riesgo:

El catalogo de permisos debe permanecer sincronizado con seed/migraciones.

Mejoras recomendadas:

- cuando se agregue un permiso, actualizar SQL seed, catalogo TS, nav y tests;
- considerar un test que compare permisos esperados si el catalogo crece.

### `src/features/appointments`

Responsabilidad:

Citas, agenda, disponibilidad, lifecycle, wizard y creacion atomica de citas.

Estructura:

- `schemas.ts`
- `view-models.ts`
- `domain/availability.ts`
- `domain/calendar.ts`
- `domain/lifecycle.ts`
- `domain/scheduling.ts`
- `domain/wizard-availability.ts`
- `data/appointments.repo.ts`
- `data/appointment-commands.repo.ts`
- `use-cases/*`
- tests de dominio y use-cases

Estado:

Muy bueno. Es el modulo mas profundo del proyecto y esta bien justificado. La
complejidad vive donde debe vivir.

Fortalezas:

- reglas puras separadas de Supabase;
- `appointment_items` se respeta como fuente de verdad;
- creacion usa RPC para atomicidad;
- validaciones de disponibilidad existen para UX, pero SQL mantiene autoridad
  final;
- tests cubren disponibilidad, scheduling, lifecycle y creacion.

Riesgo:

Es el modulo mas critico del producto. Cualquier atajo aqui crea deuda cara.

Mejoras recomendadas:

- no permitir queries de citas en `src/app`;
- seguir agregando tests antes de tocar disponibilidad o lifecycle;
- mantener comments/docs cuando una regla exista duplicada en TS y SQL.

### `src/features/customers`

Responsabilidad:

Gestion de clientes, duplicados, temporales, archivado/reactivacion y perfil.

Estructura:

- `schemas.ts`
- `data/customers.repo.ts`
- `use-cases/*`

Estado:

Bueno para el nivel actual. No tiene `domain/`, pero no se ve como problema
mientras las reglas sigan siendo simples.

Riesgo:

`customer-lifecycle.ts` ya contiene reglas de archivado/reactivacion. Si crece,
puede merecer `domain/customer-lifecycle.ts`.

Mejoras recomendadas:

- extraer a `domain/` si aparecen mas reglas puras sobre estados de cliente;
- mantener repositorio como unico lugar con queries de clientes.

### `src/features/dashboard`

Responsabilidad:

Read model del dashboard operativo del salon.

Estructura:

- `data/dashboard.repo.ts`
- `use-cases/get-dashboard-overview.ts`

Estado:

Correcto. Es un modulo de lectura, no necesariamente un dominio profundo. Junta
datos de citas, clientes y servicios para construir una vista.

Riesgo:

Los read models tienden a volverse "bolsas" de queries si no se les pone limite.

Mejoras recomendadas:

- mantenerlo orientado a vista, no a reglas de negocio;
- si una metrica se vuelve reutilizable, mover calculo puro a domain.

### `src/features/employees`

Responsabilidad:

Colaboradores, horarios, accesos, invitaciones y asignaciones de servicios.

Estructura:

- `schemas.ts`
- `domain/collaborator-assignment.ts`
- `data/employees.repo.ts`
- `data/employee-access.repo.ts`
- `use-cases/*`
- tests de dominio y use-cases

Estado:

Bueno. Tiene separacion razonable entre asignaciones, repositorios y casos de
uso.

Riesgo:

`employee-invitations.ts` y `employee-access.ts` llaman helpers de
`@/lib/supabase/auth-admin`. No es inseguro por si mismo porque `auth-admin`
usa `server-only`, pero arquitectonicamente mezcla orquestacion con adaptador
externo privilegiado.

Mejoras recomendadas:

- mover operaciones de Supabase Auth hacia un adapter del feature, por ejemplo
  `features/employees/data/employee-auth.repo.ts`, o documentar la excepcion en
  ADR 0010;
- mantener tests de rollback cuando se crea usuario Auth y falla perfil/enlace.

### `src/features/feedback`

Responsabilidad:

Enviar feedback del salon hacia soporte/plataforma.

Estructura:

- `schemas.ts`
- `data/feedback.repo.ts`
- `use-cases/submit-feedback.ts`

Estado:

Simple y correcto. No requiere `domain/` mientras solo sea captura de feedback.

Riesgo:

Si se agregan estados, SLA, prioridad o asignacion de soporte, debe crecer como
modulo real y no quedar escondido en layout.

Mejoras recomendadas:

- mover UI especifica a `features/feedback/components` si el flujo crece;
- dejar platform moderation en `features/platform` si pertenece al superadmin.

### `src/features/notifications`

Responsabilidad:

Plantillas de mensajes operativos.

Estructura:

- `schemas.ts`
- `domain/templates.ts`
- `data/notification-templates.repo.ts`
- `use-cases/*`
- tests de dominio y use-cases

Estado:

Bueno. `renderMessageTemplate` y placeholders viven como dominio puro.

Riesgo:

La semantica de eventos y placeholders debe mantenerse alineada con ADR 0007 y
tabla `notification_templates`.

Mejoras recomendadas:

- si se agregan canales nuevos, separar canal/evento/plantilla con cuidado;
- no meter render de plantillas en componentes.

### `src/features/platform`

Responsabilidad:

Modulo de administracion global de plataforma.

Estructura:

- `data/*`
- `use-cases/*`
- tests de use-cases y repositorios

Estado:

Bueno y bien aislado. Los repositorios de plataforma son los principales puntos
autorizados para `service_role`.

Fortalezas:

- operaciones cross-tenant viven fuera del dashboard tenant;
- borrado completo de salon esta detras de use-case y RPC;
- read model `platform_salon_overviews` evita queries N+1.

Riesgo:

El modulo tiene operaciones irreversibles. Debe ser tratado como zona de alto
riesgo.

Mejoras recomendadas:

- mantener guardrail de admin client;
- agregar logs/auditoria de operaciones destructivas si el producto avanza;
- considerar domain puro si aparecen reglas complejas de plataforma.

### `src/features/reminders`

Responsabilidad:

Modulo de lectura para cola de recordatorios.

Estructura:

- `view-models.ts`
- `use-cases/get-reminder-queue.ts`
- test del use-case

Estado:

Correcto como read module. Consume repositorios de appointments, employees,
notifications y salon para construir una vista operativa.

Evaluacion:

No necesita `data/` propio si no posee tablas/queries propias todavia. Su
responsabilidad es componer datos de otros modulos para una pantalla concreta.

Riesgo:

Si empieza a enviar recordatorios reales, registrar logs o manejar reintentos,
debe crecer con `data/`, `domain/` y posiblemente integracion externa.

Mejoras recomendadas:

- mantener `get-reminder-queue` como lectura;
- cuando exista envio real, crear use-cases separados:
  `send-reminder`, `record-reminder-attempt`, `retry-reminder`.

### `src/features/reports`

Responsabilidad:

Reportes operativos del salon.

Estructura:

- `schemas.ts`
- `domain/metrics.ts`
- `domain/period.ts`
- `data/reports.repo.ts`
- `use-cases/get-operational-report.ts`
- tests de metricas y periodos

Estado:

Muy bueno. El calculo de metricas esta separado de Supabase. El repositorio
normaliza rows y el use-case decide periodo/timezone.

Fortalezas:

- usa `appointment_items` para desgloses por empleado/servicio;
- dominio puro testeable;
- route en `src/app` queda delgada.

Riesgo:

Los reportes pueden crecer rapido. Si se mezclan muchas metricas en un solo
archivo, `metrics.ts` puede volverse grande.

Mejoras recomendadas:

- separar metricas por familia si crecen: revenue, asistencia, capacidad,
  empleados, servicios;
- mantener data adapters orientados a read models.

### `src/features/salon`

Responsabilidad:

Configuracion del salon, horarios, tema, identidad, features habilitadas y shell
del dashboard.

Estructura:

- `schemas.ts`
- `domain/salon-features.ts`
- `data/salon.repo.ts`
- `use-cases/*`
- tests de domain y use-cases

Estado:

Bueno. `salon-features.ts` es una interfaz estable que tambien usa layout para
navegacion.

Riesgo:

Salon es un modulo transversal. Si se convierte en "todo lo que no tiene casa",
puede acumular demasiada responsabilidad.

Mejoras recomendadas:

- mantenerlo limitado a identidad/configuracion/capacidades del salon;
- si una regla pertenece a citas, servicios o empleados, no meterla aqui solo
  porque tiene `salon_id`.

### `src/features/services`

Responsabilidad:

Catalogo de categorias y servicios.

Estructura:

- `schemas.ts`
- `data/services.repo.ts`
- `use-cases/*`
- tests de catalogo

Estado:

Correcto. No tiene `domain/`, lo cual es aceptable si el comportamiento principal
es CRUD/catologo.

Riesgo:

Cuando aparezcan reglas de precio, duracion minima, impuestos, paquetes o
dependencias entre servicios, `domain/` sera necesario.

Mejoras recomendadas:

- extraer reglas puras cuando el catalogo deje de ser CRUD;
- mantener asignaciones con empleados alineadas con constraints SQL de tenant.

## `src/lib`

Responsabilidad:

Infraestructura y utilidades compartidas.

### `src/lib/supabase`

Responsabilidad:

Clientes Supabase:

- browser client;
- server client;
- admin client;
- helpers de Supabase Auth admin.

Estado:

Bueno. `admin.ts` importa `server-only`, no persiste sesion y documenta que
`service_role` bypass RLS.

Riesgo:

`auth-admin.ts` es una puerta privilegiada. Aunque esta protegida por
`server-only`, debe tratarse como adapter externo sensible.

Mejoras recomendadas:

- no importar `admin.ts` fuera de allowlist;
- considerar mover operaciones Auth admin a adapters de feature si se quiere
  una separacion mas estricta;
- no usar variables `NEXT_PUBLIC_*` para secretos.

### `src/lib/auth`

Responsabilidad:

Sesion, perfil activo, permisos y validacion de platform admin.

Estado:

Util y centralizado. `session.ts` permite que routes/use-cases reciban un perfil
coherente y evita duplicar auth en cada pantalla.

Riesgo:

Mezcla varias responsabilidades cercanas: perfil, tenant activo, salon activo y
platform admin. Hoy es aceptable; si crece, puede perder claridad.

Mejoras recomendadas:

- si aumenta complejidad, separar en:
  - `tenant-session.ts`
  - `platform-session.ts`
  - `profile-queries.ts`
- mantener `permissions.ts` como interfaz estable de permisos para UI y
  server actions.

### `src/lib/utils`

Responsabilidad:

Utilidades genericas: fechas, telefono, classnames.

Estado:

Correcto y con tests para fechas/telefono.

Riesgo:

Las utilidades genericas pueden convertirse en cajon de sastre.

Mejoras recomendadas:

- solo poner aqui funciones verdaderamente transversales;
- si una utilidad habla de citas, servicios, clientes o salon, debe vivir en su
  feature.

### `src/lib/validation`

Responsabilidad:

Validaciones compartidas que no pertenecen a un feature especifico.

Estado:

Correcto.

Mejoras recomendadas:

- mantener validaciones de negocio dentro del feature correspondiente.

### `src/lib/result.ts`

Responsabilidad:

Contrato simple de resultado para use-cases/actions.

Estado:

Correcto. Ayuda a estandarizar errores esperados sin excepciones para flujo
normal.

Mejoras recomendadas:

- seguir usandolo en use-cases que retornan errores de negocio;
- no usarlo para ocultar errores inesperados sin log.

## `src/types`

Responsabilidad:

Tipos transversales y tipos generados de Supabase.

Estado:

Correcto. `database.types.ts` debe considerarse generado desde Supabase.

Riesgo:

Si se edita manualmente, se rompe el contrato con la base de datos.

Mejoras recomendadas:

- regenerar con `npm run db:types` despues de migraciones;
- mantener tipos de feature dentro del feature cuando no sean globales.

## `src/test`

Responsabilidad:

Soporte de testing.

Estado:

Pequeno y correcto. Existe `server-only.ts` para entorno de tests.

Mejoras recomendadas:

- agregar helpers compartidos solo cuando reduzcan duplicacion real;
- evitar fixtures globales muy grandes que oculten reglas de negocio.

## Evaluacion SOLID

### Single Responsibility Principle

Estado: bueno.

Los modulos ya estan separados por responsabilidad de producto. `appointments`,
`reports`, `employees`, `notifications` y `salon` muestran una separacion clara
entre dominio, use-cases y data.

Punto a vigilar:

`src/lib/auth/session.ts` y algunos route-local components pueden acumular
responsabilidades si no se controlan.

### Open/Closed Principle

Estado: razonable.

La arquitectura permite agregar features, use-cases y data adapters sin tocar
todo el sistema. `SALON_FEATURES`, permisos y plantillas son extensibles con
disciplina.

Punto a vigilar:

Cada feature nuevo debe actualizar nav, permisos, RLS y docs cuando aplique.

### Liskov Substitution Principle

Estado: poco relevante por ahora.

No hay jerarquias complejas de clases ni polimorfismo fuerte. Esto es bueno:
no se introdujeron abstracciones innecesarias.

### Interface Segregation Principle

Estado: bueno.

Las interfaces actuales son pequenas y concretas: schemas por feature, view
models especificos y repositorios enfocados.

Punto a vigilar:

No crear un "repository generico" global para todo Supabase. Seria menos claro.

### Dependency Inversion Principle

Estado: pragmatico.

Los use-cases dependen de funciones concretas de repositorio, no de puertos
abstractos. Para este tamano de proyecto es una decision sana. Crear interfaces
por cada repo antes de necesitarlas seria sobreingenieria.

Punto a mejorar:

Donde hay integraciones externas privilegiadas, como Supabase Auth Admin, si
conviene acercarse mas a DIP: los use-cases deberian depender de un adapter del
feature, no del helper global.

## Reglas Que Estan Bien Implementadas

- El dominio puro no depende de tecnologia externa.
- La base de datos mantiene autoridad final para tenant isolation e integridad.
- Las rutas no acceden directamente a repositorios.
- `service_role` no esta disponible en browser.
- `appointment_items` sigue siendo fuente de verdad para disponibilidad y
  reportes.
- No se estan creando carpetas vacias solo para aparentar arquitectura.
- Las reglas criticas tienen tests.

## Deuda Tecnica Actual

Prioridad alta:

1. Revisar el uso directo de `@/lib/supabase/auth-admin` desde use-cases.
   Recomendacion: moverlo a adapters de data por feature o documentar mejor la
   excepcion.

2. Asegurar que `architecture:check`, `test`, `type-check`, `lint` y `build`
   corran antes de merge/deploy.

Prioridad media:

3. Separar `src/lib/auth/session.ts` si crece mas.

4. Extraer componentes grandes de `src/app` solo cuando contengan reglas de
   negocio, se reutilicen o dificulten leer la ruta.

5. Dar ownership explicito a modulos de lectura como `dashboard`, `reports` y
   `reminders` para que no se vuelvan cajones de queries.

Prioridad baja:

6. Mantener un indice de docs que diga cual auditoria y cuales fases estan
   vigentes.

7. Agregar pequenos README por feature solo si el equipo necesita navegar mas
   rapido los limites de cada modulo.

## Recomendacion Arquitectonica

No recomiendo cambiar a microservicios ni partir el repositorio. GlowBook esta
en una etapa donde un monolito modular es la opcion correcta:

- el dominio todavia comparte transacciones y tenant;
- Supabase/RLS es un contrato comun fuerte;
- citas, empleados, clientes, servicios y reportes necesitan coherencia local;
- separar servicios ahora aumentaria complejidad operativa sin suficiente
  beneficio.

La mejora correcta no es partir el sistema, sino seguir profundizando los
modulos:

1. mantener `src/app` como delivery;
2. mantener `features/*/domain` puro;
3. mantener Supabase en `features/*/data`;
4. usar use-cases como punto de entrada de negocio;
5. dejar que SQL/RLS/RPC sea autoridad final de seguridad;
6. reforzar guardrails cuando aparezcan nuevas fugas.

## Plan De Mejora Sugerido

### Corto Plazo

- Commit de los guardrails y ADRs actuales.
- Agregar esta auditoria como referencia vigente.
- Mantener `architecture:check` en `lint`.
- Revisar imports a `auth-admin` desde use-cases.

### Medio Plazo

- Crear adapters de Auth admin por feature si sigue creciendo:
  - `features/employees/data/employee-auth.repo.ts`
  - `features/platform/data/platform-auth.repo.ts`
- Convertir warning de use-cases con Supabase server en error cuando ya no haya
  excepciones validas.
- Agregar README pequeno en features de alto riesgo:
  - appointments
  - employees
  - platform
  - reports

### Largo Plazo

- Agregar E2E para flujos multi-tenant criticos.
- Agregar checks automatizados de RLS/RPC si el entorno de Supabase de test lo
  permite.
- Crear dashboard tecnico de deuda: guardrails, tests skipped, migraciones
  pendientes, types desactualizados.

## Conclusión

La arquitectura actual de GlowBook esta bien encaminada hacia un monolito
modular. La separacion por features ya no es cosmetica: existen limites reales,
guardrails automatizados y una buena red de tests.

El mayor valor ahora esta en proteger lo conseguido. No hace falta una
reescritura grande. Hace falta disciplina: mantener las rutas delgadas, no
filtrar Supabase hacia capas equivocadas, documentar excepciones privilegiadas
y mover reglas puras al dominio cuando aparezca complejidad real.

En resumen: la estructura esta bastante sana. El siguiente paso no es cambiar
de arquitectura, sino endurecer los bordes para que el proyecto pueda crecer sin
volver a mezclarse.
