# Fases Derivadas De La Auditoria De Arquitectura

Fecha: 2026-05-30

Fuente: `docs/architecture-audit-2026-05-30.md`

Este documento convierte la auditoria actual en fases de trabajo ejecutables.
Continua despues de la Fase 16 de la iteracion arquitectonica anterior, porque
las fases 10-16 ya atacaron los problemas grandes de `app -> data`, read
Modules, commands de citas, tests secundarios y guardrails basicos.

La direccion arquitectonica se mantiene: GlowBook debe seguir como monolito
modular feature-first. Estas fases no proponen microservicios ni una reescritura
grande. Buscan proteger lo conseguido, profundizar Modules con friccion real y
cerrar las excepciones que todavia quedan.

## Principios De Estas Fases

1. Mantener `src/app` como Interface de delivery: sesion, permisos, parseo,
   llamada a use-case, render y revalidacion.
2. Mantener `src/features/*/domain` puro: sin React, Next, Supabase ni
   `server-only`.
3. Mantener `src/features/*/data` como Adapter de Supabase, Postgres, RPCs y
   Auth externo.
4. Mantener `src/features/*/use-cases` como Interface de negocio para callers
   de `app`.
5. No crear Seams abstractos si solo existe un Adapter y no hay presion real.
6. Documentar excepciones privilegiadas. Una excepcion no documentada se vuelve
   deuda.
7. Agregar tests donde un Module concentre reglas, mapeos, rollback o errores
   de negocio.
8. Mantener SQL/RLS/RPC/constraints como autoridad final de seguridad e
   integridad.

## Estado Objetivo Despues De Estas Fases

```text
src/app
  -> no importa data adapters
  -> no conoce query shape, RPCs ni service_role
  -> conserva UI local solo si es presentacion de ruta

src/features/<dominio>/use-cases
  -> orquestan reglas, permisos de negocio y adapters
  -> no importan Supabase directo salvo excepcion documentada

src/features/<dominio>/data
  -> concentra Supabase/Postgres/RPC/Auth externo
  -> contiene Adapters privilegiados cuando sean necesarios

src/features/<dominio>/domain
  -> reglas puras con tests

docs
  -> auditoria vigente, fases vigentes, ADRs y contratos faciles de encontrar

scripts/check-architecture.mjs
  -> bloquea regresiones de capas y reporta excepciones auditables
```

## Fase 17 - Encapsular Supabase Auth Admin En Adapters De Feature

Objetivo: sacar llamadas directas a `@/lib/supabase/auth-admin` desde use-cases
y dejarlas detras de Adapters concretos en `features/*/data`.

Estado: implementada el 2026-05-30.

Problemas que resuelve:

- `src/features/employees/use-cases/employee-invitations.ts` usa Auth Admin
  directo para crear/borrar usuarios.
- `src/features/employees/use-cases/employee-access.ts` usa Auth Admin directo
  para borrar usuarios.
- `src/features/platform/use-cases/accept-invitation.ts` usa Auth Admin directo
  en un flujo sensible de onboarding.
- Los use-cases mezclan orquestacion de negocio con una integracion externa
  privilegiada.

Trabajo:

1. Crear `src/features/employees/data/employee-auth.repo.ts`.
2. Mover ahi las operaciones Auth usadas por empleados:
   - crear usuario Auth para colaborador;
   - borrar usuario Auth en rollback o revocacion;
   - mapear errores de Auth si aplica.
3. Crear `src/features/platform/data/platform-auth.repo.ts` si plataforma sigue
   necesitando crear, buscar o actualizar usuarios Auth.
4. Actualizar use-cases para depender de esos Adapters, no de
   `@/lib/supabase/auth-admin`.
5. Mantener `src/lib/supabase/auth-admin.ts` como Adapter tecnico bajo
   `server-only`.
6. Ajustar tests existentes para mockear el Adapter del feature.
7. Documentar la excepcion en ADR 0010 si algun use-case debe seguir llamando
   Auth Admin directamente por una razon fuerte.

Archivos esperados:

- `src/features/employees/data/employee-auth.repo.ts`
- `src/features/platform/data/platform-auth.repo.ts`
- `src/features/employees/use-cases/employee-invitations.ts`
- `src/features/employees/use-cases/employee-access.ts`
- `src/features/platform/use-cases/accept-invitation.ts`
- tests relacionados
- posible update en `docs/adr/0010-server-only-admin-adapter-exceptions.md`

Criterio de terminado:

- `rg "@/lib/supabase/auth-admin" src/features/*/use-cases` no encuentra usos
  productivos.
- Los rollback de Auth siguen cubiertos por tests.
- `server-only` sigue protegiendo la llave privilegiada.
- `npm run test`, `npm run type-check`, `npm run lint` y `npm run build` pasan.

Riesgo: medio.

Resultado implementado:

- Se creo `src/features/employees/data/employee-auth.repo.ts`.
- Se creo `src/features/platform/data/platform-auth.repo.ts`.
- `employee-invitations.ts`, `employee-access.ts` y `accept-invitation.ts`
  ya no importan `@/lib/supabase/auth-admin` directamente.
- Se agregaron tests de rollback y reutilizacion Auth:
  - `src/features/employees/use-cases/employee-invitations.test.ts`
  - `src/features/platform/use-cases/accept-invitation.test.ts`
- `employee-access.test.ts` ahora mockea el Adapter del feature.

## Fase 18 - Endurecer Guardrails De Integraciones Privilegiadas

Objetivo: convertir las excepciones de Auth Admin y Supabase directo en reglas
auditables.

Estado: implementada el 2026-05-30.

Problemas que resuelve:

- Despues de Fase 17, deberia ser posible bloquear nuevos imports de
  `auth-admin` desde use-cases.
- `architecture:check` ya advierte sobre `features/*/use-cases ->
  @/lib/supabase/server`, pero no bloquea.
- Las reglas de capas dependen de disciplina si no se ejecutan en CI.

Trabajo:

1. Extender `scripts/check-architecture.mjs` para detectar:
   - `features/*/use-cases -> @/lib/supabase/auth-admin`;
   - `features/*/use-cases -> @/lib/supabase/admin`;
   - `src/app -> @/lib/supabase/admin`;
   - `src/components -> @/lib/supabase/*`.
2. Bloquear imports privilegiados fuera de Adapters autorizados.
3. Mantener warnings para Supabase server directo en use-cases si aun hay
   excepciones validas.
4. Convertir warnings de Supabase server directo en error cuando no queden
   excepciones productivas.
5. Documentar allowlist en ADR 0010.
6. Agregar en README o docs el comando obligatorio:
   - `npm run lint`
   - `npm run test`
   - `npm run type-check`
   - `npm run build`

Archivos esperados:

- `scripts/check-architecture.mjs`
- `docs/adr/0010-server-only-admin-adapter-exceptions.md`
- `README.md` o `docs/README.md`

Criterio de terminado:

- No se puede reintroducir Auth Admin en use-cases accidentalmente.
- `architecture:check` pasa sin warnings no explicados.
- Las excepciones privilegiadas tienen owner y razon documentada.

Riesgo: bajo-medio.

Resultado implementado:

- `scripts/check-architecture.mjs` bloquea imports directos a Auth Admin fuera
  de Adapters autorizados por ADR 0010.
- El guardrail bloquea imports Supabase desde `src/components`.
- ADR 0010 documenta los Adapters:
  - `src/features/employees/data/employee-auth.repo.ts`
  - `src/features/platform/data/platform-auth.repo.ts`
  - `src/features/platform/data/delete-salon.repo.ts`
- `npm run architecture:check` pasa.

## Fase 19 - Crear Indice De Documentacion Vigente Y Contratos Por Feature

Objetivo: reducir deuda documental y hacer claro que documento manda.

Estado: implementada el 2026-05-30.

Problemas que resuelve:

- Existen auditorias, fases y ADRs de fechas distintas.
- Es facil abrir un documento viejo y creer que es el plan vigente.
- Algunos features de alto riesgo no tienen una Interface documentada en texto.

Trabajo:

1. Crear `docs/README.md` con:
   - auditoria vigente;
   - fases vigentes;
   - politica para retirar documentos reemplazados;
   - ADRs importantes;
   - contrato de base de datos.
2. Marcar `docs/architecture-audit-2026-05-30.md` como auditoria vigente.
3. Marcar este documento como fases vigentes.
4. Agregar README pequenos solo en Modules de alto riesgo:
   - `src/features/appointments/README.md`
   - `src/features/employees/README.md`
   - `src/features/platform/README.md`
   - `src/features/reports/README.md`
5. Cada README debe incluir:
   - responsabilidad del Module;
   - Interface principal;
   - autoridad final de reglas;
   - Adapters externos;
   - tests que protegen el Module;
   - que no debe vivir ahi.

Archivos esperados:

- `docs/README.md`
- `src/features/appointments/README.md`
- `src/features/employees/README.md`
- `src/features/platform/README.md`
- `src/features/reports/README.md`

Criterio de terminado:

- Un desarrollador puede encontrar el plan vigente en menos de un minuto.
- Los Modules de alto riesgo tienen ownership explicito.
- No se agregan READMEs genericos sin informacion operativa real.

Riesgo: bajo.

Resultado implementado:

- Se creo `docs/README.md`.
- Se agregaron contratos breves de Modules de alto riesgo:
  - `src/features/appointments/README.md`
  - `src/features/employees/README.md`
  - `src/features/platform/README.md`
  - `src/features/reports/README.md`

## Fase 20 - Resolver Tests Skipped Y Checks De RLS/RPC

Objetivo: fortalecer la red de seguridad de Supabase, especialmente donde SQL
es autoridad final.

Estado: implementada el 2026-05-30 con skip controlado solo si falta entorno Supabase.

Problemas que resuelve:

- La suite actual tiene 2 tests skipped relacionados con Supabase/RPC.
- RLS, RPCs y triggers son autoridad final, pero no todo puede verificarse con
  unit tests.
- El riesgo multi-tenant no se debe validar solo manualmente.

Trabajo:

1. Documentar variables requeridas para tests de Supabase:
   - `SUPABASE_TEST_EMAIL`
   - `SUPABASE_TEST_PASSWORD`
   - otras variables si aplican.
2. Crear un modo claro para correr tests de integracion:
   - local contra Supabase linkeado;
   - o contra proyecto/staging controlado.
3. Revisar los tests skipped y decidir:
   - activarlos cuando haya env vars;
   - mantener skip explicito con razon;
   - dividir unit test vs integration test.
4. Agregar checks para contratos criticos:
   - `create_appointment` RPC;
   - no-overlap por `appointment_items`;
   - platform-only operations;
   - tenant isolation basica.
5. Documentar flujo en `docs/database-contracts.md`.

Archivos esperados:

- tests RPC/RLS existentes ajustados
- posible `docs/testing.md` o seccion en `README.md`
- `docs/database-contracts.md`

Criterio de terminado:

- Los skipped tests tienen razon clara o se ejecutan con env vars.
- Existe una ruta documentada para validar Supabase real.
- Cambios en RLS/RPC tienen checklist de verificacion.

Riesgo: medio.

Resultado implementado:

- Se creo `docs/testing.md` con variables y flujo de tests Supabase/RPC.
- `docs/database-contracts.md` referencia el contrato de tests Supabase.
- El suite skipped de `create_appointment RPC` ahora explica en su nombre que
  requiere variables de integracion Supabase.
- Se creo `src/test/supabase-integration-fixtures.ts` para generar usuarios y
  Salon temporal cuando hay `SUPABASE_SERVICE_ROLE_KEY`.
- `create_appointment.rpc.test.ts` ahora corre sin `SUPABASE_TEST_EMAIL` y
  `SUPABASE_TEST_PASSWORD` si existe service role.

Pendiente:

- Agregar checks RLS/Platform adicionales cuando se quiera ampliar la cobertura
  mas alla del RPC de citas.

## Fase 21 - Dar Ownership Explicito A Modules De Lectura

Objetivo: evitar que `dashboard`, `reports` y `reminders` se vuelvan cajones de
queries sin reglas claras.

Estado: implementada el 2026-05-30.

Problemas que resuelve:

- `dashboard` junta datos de citas, clientes y servicios.
- `reminders` compone citas, empleados, salon y plantillas.
- `reports` puede crecer rapido y mezclar muchas metricas en un solo archivo.

Trabajo:

1. Revisar read Modules actuales:
   - `src/features/dashboard`
   - `src/features/reports`
   - `src/features/reminders`
2. Documentar para cada uno:
   - si es vista, dominio o flujo operativo;
   - que datos puede componer;
   - que reglas no debe poseer.
3. Separar `reports/domain/metrics.ts` solo si crece por familias reales:
   - revenue;
   - asistencia;
   - empleados;
   - servicios;
   - capacidad.
4. Si `reminders` empieza a enviar mensajes reales, crear Modules separados:
   - `send-reminder`;
   - `record-reminder-attempt`;
   - `retry-reminder`.
5. Mantener tests para mapeos de view models y calculos.

Archivos esperados:

- README o notas en features de lectura
- posibles nuevos Modules de domain en `reports`
- futuros Modules de reminders si existe envio real
- tests correspondientes

Criterio de terminado:

- Cada read Module tiene responsabilidad clara.
- Ningun read Module es un "misc" de queries.
- Las metricas reutilizables tienen tests de dominio.

Riesgo: bajo-medio.

Resultado implementado:

- `src/features/dashboard/README.md` define al Module como read Module de vista.
- `src/features/reminders/README.md` define el alcance de cola operativa.
- `src/features/reports/README.md` documenta ownership de metricas y criterio
  para separar familias reales de metricas.

## Fase 22 - Higiene De UI Route-Local En `src/app`

Objetivo: evitar que componentes locales de rutas acumulen reglas de negocio,
sin mover UI por moverla.

Estado: evaluada el 2026-05-30.

Problemas que resuelve:

- `src/app/(dashboard)` contiene muchos componentes de pantalla.
- Eso es aceptable si son presentacion local, pero se vuelve deuda si contienen
  reglas de dominio, mapeos complejos o duplicacion.

Trabajo:

1. Inventariar componentes grandes dentro de:
   - `appointments`
   - `customers`
   - `employees`
   - `services`
   - `reports`
   - `plantillas`
2. Clasificar cada componente:
   - UI local de ruta: se queda en `src/app`;
   - UI reutilizable de feature: mover a `src/features/<feature>/components`;
   - regla de negocio: mover a `domain` o use-case;
   - mapeo de datos: mover a use-case/view-model.
3. Extraer solo cuando haya ganancia real de Locality.
4. Evitar crear carpetas vacias.
5. Agregar tests solo si se extrae logica, no por markup trivial.

Archivos esperados:

- cambios puntuales en `src/app/(dashboard)/*`
- posibles `src/features/<feature>/components/*`
- posibles tests si se extrae logica

Criterio de terminado:

- Las rutas siguen siendo legibles.
- UI local no contiene queries ni reglas de negocio.
- No se agregan capas cosmeticas.

Riesgo: bajo-medio.

Resultado aplicado:

- Se creo `docs/ui-route-local-inventory-2026-05-30.md`.
- Se verifico que `src/app` no importa `features/*/data`.
- Los usos directos de Supabase en `src/app` quedan limitados a delivery/auth.
- No se movio UI porque no habia ganancia real de Locality.

## Fase 23 - Separar Auth/Session Solo Si La Complejidad Lo Justifica

Objetivo: preparar una separacion de `src/lib/auth/session.ts` sin hacerla
prematuramente.

Estado: evaluada; condicion no activada el 2026-05-30.

Problemas que podria resolver:

- `session.ts` concentra perfil, tenant activo, salon activo y platform admin.
- Si crece mas, puede perder Locality.

Condicion para iniciar:

Iniciar esta fase solo si se cumple al menos una de estas condiciones:

- `session.ts` supera un tamano dificil de leer;
- se agregan mas flujos platform;
- aparecen reglas diferentes para owner, colaborador, platform admin o usuario
  invitado;
- tests de auth empiezan a requerir demasiados mocks.

Trabajo:

1. Separar solo los Modules que tengan responsabilidad clara:
   - `src/lib/auth/profile-session.ts`
   - `src/lib/auth/tenant-session.ts`
   - `src/lib/auth/platform-session.ts`
2. Mantener una Interface publica pequena para callers.
3. No cambiar comportamiento de redirects.
4. Actualizar tests existentes.
5. Verificar que `src/app` siga usando helpers simples.

Archivos esperados:

- `src/lib/auth/session.ts`
- posibles nuevos files bajo `src/lib/auth`
- `src/lib/auth/session.test.ts` o tests nuevos

Criterio de terminado:

- La separacion reduce friccion real.
- Callers no quedan obligados a conocer mas detalles.
- Redirects y permisos siguen iguales.

Riesgo: medio.

Resultado aplicado:

- Se creo `docs/auth-session-review-2026-05-30.md`.
- `src/lib/auth/session.ts` se mantiene como fachada pequena.
- No se separo el Module para evitar Seams superficiales.

## Fase 24 - E2E Minimo Para Flujos Criticos

Objetivo: cubrir flujos completos que los unit tests no protegen bien.

Estado: implementada el 2026-05-30 como smoke E2E critico.

Problemas que resuelve:

- Unit tests protegen Modules, pero no garantizan que UI, Server Actions,
  permisos, RLS y Supabase se conecten bien.
- Los flujos multi-tenant y platform son de alto impacto.

Trabajo:

1. Elegir herramienta E2E si aun no existe.
2. Cubrir smoke tests minimos:
   - login;
   - dashboard de salon activo;
   - crear cita;
   - cancelar/confirmar/completar cita;
   - archivar/reactivar cliente;
   - invitar colaborador;
   - platform admin ve salones;
   - feature disabled no aparece ni es accesible.
3. Separar seed/test data de datos reales.
4. Documentar como correr E2E localmente.

Archivos esperados:

- configuracion E2E
- tests E2E
- docs de ejecucion

Criterio de terminado:

- Existe cobertura minima de flujos de mayor riesgo.
- Los tests no dependen de datos manuales inestables.
- Fallos de conexion Supabase/UI se detectan antes de deploy.

Riesgo: medio-alto.

Resultado aplicado:

- Se creo `docs/e2e-critical-flows.md`.
- Se instalo `@playwright/test`.
- Se creo `playwright.config.ts`.
- Se agregaron scripts:
  - `npm run test:e2e`
  - `npm run test:e2e:ui`
- Se agregaron tests E2E:
  - `e2e/auth.spec.ts`
  - `e2e/salon-owner.spec.ts`
  - `e2e/platform-admin.spec.ts`
  - `e2e/feature-disabled.spec.ts`
- Se instalo Chromium de Playwright en el entorno local.
- Los tests autenticados usan credenciales si existen o fixtures temporales si
  existe `SUPABASE_SERVICE_ROLE_KEY`.
- La suite cubre login, dashboard, creacion de cita, confirmar/completar/cancelar
  cita, archivar/reactivar cliente, generar invitacion de colaborador,
  plataforma y feature disabled.
- `npm run test:e2e` pasa con 11 tests.

## Fase 25 - Dashboard Tecnico De Salud Arquitectonica

Objetivo: tener una vista rapida de deuda tecnica y validaciones pendientes.

Estado: implementada el 2026-05-30.

Problemas que resuelve:

- Es facil olvidar tests skipped, tipos desactualizados, migraciones pendientes
  o warnings de arquitectura.
- El estado arquitectonico queda repartido entre consola, docs y memoria.

Trabajo:

1. Crear script de reporte tecnico, por ejemplo:
   - `scripts/architecture-health.mjs`
2. El reporte debe mostrar:
   - resultado de `architecture:check`;
   - cantidad de tests skipped;
   - imports privilegiados;
   - archivos de docs vigentes;
   - migraciones recientes;
   - si `database.types.ts` parece desactualizado despues de migraciones.
3. No bloquear build al inicio; usarlo como reporte.
4. Si demuestra valor, integrarlo en CI como artifact.

Archivos esperados:

- `scripts/architecture-health.mjs`
- posible doc de uso en `docs/README.md`

Criterio de terminado:

- El equipo puede ver la salud arquitectonica sin recordar diez comandos.
- El reporte ayuda a priorizar, no reemplaza tests ni lint.

Riesgo: bajo.

Resultado implementado:

- Se creo `scripts/architecture-health.mjs`.
- Se agrego script `npm run architecture:health`.
- El reporte muestra guardrail, tests skipped, E2E skipped, imports
  privilegiados, docs vigentes, migraciones recientes y estado aproximado de
  `database.types.ts`.

## Orden Recomendado

```text
Fase 17  Encapsular Supabase Auth Admin en Adapters de feature
Fase 18  Endurecer guardrails de integraciones privilegiadas
Fase 19  Indice de documentacion vigente y contratos por feature
Fase 20  Resolver tests skipped y checks de RLS/RPC
Fase 21  Ownership explicito de Modules de lectura
Fase 22  Higiene de UI route-local en src/app
Fase 23  Separar auth/session solo si la complejidad lo justifica
Fase 24  E2E minimo para flujos criticos
Fase 25  Dashboard tecnico de salud arquitectonica
```

## Mapa De Hallazgos A Fases

| Hallazgo de auditoria | Fase |
|---|---|
| Use-cases llaman `@/lib/supabase/auth-admin` directamente | Fase 17 |
| Excepciones privilegiadas no estan completamente enforceadas | Fase 18 |
| Docs vigentes pueden confundirse con docs reemplazados | Fase 19 |
| Features de alto riesgo necesitan contrato textual corto | Fase 19 |
| Tests skipped de Supabase/RPC | Fase 20 |
| RLS/RPC necesita validacion ejecutable mas clara | Fase 20 |
| `dashboard`, `reports` y `reminders` pueden volverse cajones de queries | Fase 21 |
| UI route-local puede acumular reglas de negocio | Fase 22 |
| `src/lib/auth/session.ts` puede crecer demasiado | Fase 23 |
| Unit tests no cubren flujos completos | Fase 24 |
| Estado tecnico queda repartido entre comandos y docs | Fase 25 |

## Que No Hacer

- No cambiar a microservicios.
- No crear una capa global `services`.
- No crear repositorios genericos para todo Supabase.
- No mover UI local solo por tamano.
- No agregar `domain/` donde no hay reglas puras.
- No crear Interfaces abstractas si solo existe un Adapter y no hay presion
  real.
- No duplicar reglas SQL/TypeScript sin documentar cual es la autoridad final.
- No relajar `service_role`: toda excepcion debe ser server-only, documentada y
  cubierta por guardrail.

## Primer Sprint Sugerido

El primer sprint deberia ser Fase 17 + parte de Fase 18:

1. Crear `employee-auth.repo.ts`.
2. Crear `platform-auth.repo.ts` si `accept-invitation` lo necesita.
3. Migrar use-cases para no importar `@/lib/supabase/auth-admin`.
4. Ajustar tests de empleados y plataforma.
5. Agregar regla en `architecture:check` para bloquear Auth Admin directo desde
   use-cases.
6. Correr:
   - `npm run test`
   - `npm run type-check`
   - `npm run lint`
   - `npm run build`

Este sprint cierra el riesgo mas concreto de la auditoria: integraciones
privilegiadas mezcladas con orquestacion de negocio.
