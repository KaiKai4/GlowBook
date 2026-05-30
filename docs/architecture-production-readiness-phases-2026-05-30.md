# Fases De Mejora Para Produccion Y Monolito Modular

Fecha: 2026-05-30

Fuente: `docs/architecture-production-readiness-audit-2026-05-30.md`

Este documento convierte la auditoria de arquitectura y readiness de produccion
en fases ejecutables. Continua despues de la Fase 25 porque las Fases 17-25 ya
cerraron la mayor parte del orden interno del monolito modular.

El objetivo ahora no es reestructurar todo el proyecto. GlowBook ya esta bien
encaminado como monolito modular feature-first. El objetivo es cerrar los
fallos actuales que impiden operar con tranquilidad en produccion con 5 salones
o mas:

- contrato Supabase/tipos generados;
- CI/CD obligatorio;
- staging separado;
- backups y restore;
- observabilidad;
- audit log de Plataforma;
- hardening de seguridad;
- E2E contra staging;
- prueba con datos realistas;
- decision sobre recordatorios reales.

## Estado Actual De Partida

Arquitectura:

```text
85% - 90% lista para seguir desarrollando con buen orden
```

Produccion para 5+ salones:

```text
70% - 75% lista
```

Meta despues de estas fases:

```text
Arquitectura: 92% - 95%
Produccion 5+ salones: 90% - 95%
```

## Principios

1. Mantener GlowBook como monolito modular. No microservicios.
2. No crear Seams abstractos si solo existe un Adapter y no hay presion real.
3. Mantener `src/app` como Interface de delivery.
4. Mantener Supabase/Postgres/Auth/RPC dentro de Adapters auditables.
5. Mantener SQL/RLS/RPC como autoridad final de seguridad e integridad.
6. Proteger operaciones de Plataforma con trazabilidad.
7. Hacer que los gates corran automaticamente, no solo manualmente.
8. Separar readiness operativo de refactors de codigo.

## Fase 26 - Sincronizar Tipos Y Contrato Supabase

Prioridad: bloqueante antes de produccion.

Estado: implementada el 2026-05-30.

Objetivo: eliminar la alerta actual de `database.types.ts` posiblemente
desactualizado y dejar claro el flujo obligatorio para cambios de schema.

Problema que resuelve:

- `architecture:health` informa que `database.types.ts` parece mas viejo que la
  ultima migracion por `mtime`.
- Los tipos generados son parte del contrato entre Supabase y TypeScript.
- Un mismatch aqui puede generar bugs silenciosos en Adapters `data`.

Trabajo:

1. Ejecutar `npm run db:types`.
2. Revisar el diff de `src/types/database.types.ts`.
3. Confirmar que las migraciones recientes estan aplicadas en el entorno usado.
4. Actualizar `docs/database-contracts.md` si aparece algun contrato nuevo.
5. Agregar nota en `docs/testing.md` sobre cuando regenerar tipos.
6. Correr:
   - `npm run type-check`
   - `npm run test`
   - `npm run architecture:health`

Archivos esperados:

- `src/types/database.types.ts`
- `docs/database-contracts.md`
- `docs/testing.md`

Criterio de terminado:

- `architecture:health` ya no reporta tipos desactualizados, o el reporte
  documenta una razon verificable para ignorar el `mtime`.
- `type-check` pasa.
- Tests RPC/RLS pasan.

Riesgo: bajo.

Resultado implementado:

- Se ejecuto `npm run db:types`.
- Se confirmo con `npx supabase migration list` que local y remote coinciden
  desde `20240101000000` hasta `20240101000026`.
- `src/types/database.types.ts` fue regenerado; el contrato generado no cambio,
  el diff solo normalizo el encoding inicial del archivo.
- `docs/database-contracts.md` documenta el contrato de tipos generados.
- `docs/testing.md` documenta cuando regenerar tipos y como verificar despues.

## Fase 27 - CI/CD Con Gates Arquitectonicos Obligatorios

Prioridad: bloqueante antes de produccion.

Estado: implementada el 2026-05-30.

Objetivo: convertir los checks manuales en contrato automatico antes de merge o
deploy.

Problema que resuelve:

- Los guardrails existen, pero dependen de que alguien los ejecute.
- Una regresion `src/app -> features/*/data`, Auth Admin directo o Supabase en
  UI podria entrar si no hay CI.

Trabajo:

1. Crear workflow de CI para push/PR.
2. Instalar dependencias con lockfile.
3. Ejecutar:
   - `npm run lint`
   - `npm run type-check`
   - `npm run test`
   - `npm run build`
4. Decidir si `npm run test:e2e` corre en cada PR o solo en rama principal.
5. Ejecutar `npm run architecture:health` como reporte.
6. Documentar el flujo en `README.md` o `docs/README.md`.

Archivos esperados:

- `.github/workflows/ci.yml` si se usa GitHub Actions.
- `README.md`
- `docs/README.md`

Criterio de terminado:

- Un PR no puede pasar si falla lint, guardrail, type-check, tests o build.
- `architecture:check` corre dentro de `npm run lint`.
- El equipo sabe que comando reproduce CI localmente.

Riesgo: medio.

Resultado implementado:

- Se agrego `.github/workflows/ci.yml`.
- El job `Quality Gates` corre en PR y push a `main`:
  - `npm ci`
  - `npm run lint`
  - `npm run type-check`
  - `npm run test`
  - `npm run build`
- Se agrego job `E2E And Architecture Health` para `main` y ejecuciones
  manuales. Corre `npm run test:e2e` y `npm run architecture:health` cuando
  existen secretos Supabase de staging.
- Se agrego `npm run ci:verify` para reproducir localmente los gates
  obligatorios de PR.
- `README.md` y `docs/README.md` documentan el flujo.

## Fase 28 - Staging Separado Y Politica De Entornos

Prioridad: bloqueante antes de produccion.

Objetivo: tener un entorno realista donde validar Supabase, E2E y migraciones
sin tocar produccion.

Problema que resuelve:

- Hoy los tests pueden correr localmente contra variables disponibles.
- Para lanzar 5+ salones, se necesita un entorno staging controlado.
- Secrets, service role y datos de prueba deben estar separados por entorno.

Trabajo:

1. Definir entornos:
   - local;
   - staging;
   - production.
2. Crear proyecto Supabase staging.
3. Configurar variables por entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - variables E2E si aplican.
4. Documentar donde vive cada secreto y quien puede rotarlo.
5. Confirmar que los fixtures E2E no corren contra produccion.
6. Agregar proteccion explicita en docs/scripts si hace falta.

Archivos esperados:

- `.env.local.example`
- `docs/production-readiness-checklist.md`
- posible `docs/environments.md`

Criterio de terminado:

- Existe staging separado de produccion.
- E2E y RPC/RLS pueden correr contra staging.
- `SUPABASE_SERVICE_ROLE_KEY` no se expone en cliente ni en logs.

Riesgo: medio-alto.

## Fase 29 - Backups, Restore Y Migraciones De Produccion

Prioridad: bloqueante antes de produccion.

Objetivo: asegurar que los datos de salones pueden recuperarse y que las
migraciones tienen ruta de aplicacion y rollback.

Problema que resuelve:

- La base de datos ya tiene buen contrato, pero produccion necesita operacion:
  backup, restore y politica de migraciones.
- Sin restore probado, un backup es solo una promesa.

Trabajo:

1. Documentar estrategia de backup Supabase.
2. Probar restore en staging o entorno temporal.
3. Documentar flujo para aplicar migraciones:
   - revisar SQL;
   - aplicar en staging;
   - correr tests RPC/RLS;
   - aplicar en produccion.
4. Documentar rollback o mitigacion por tipo de migracion.
5. Agregar checklist antes de tocar RLS/RPC/triggers.

Archivos esperados:

- `docs/production-readiness-checklist.md`
- `docs/database-contracts.md`
- posible `docs/runbooks/database-restore.md`
- posible `docs/runbooks/database-migrations.md`

Criterio de terminado:

- Hay un restore probado y documentado.
- Hay runbook para migraciones.
- Cambios RLS/RPC tienen checklist claro.

Riesgo: alto.

## Fase 30 - Adapter De Observabilidad De Produccion

Prioridad: alta antes de produccion.

Objetivo: concentrar logging/error reporting/metricas basicas en un Adapter
transversal sin acoplar Modules de negocio a un proveedor especifico.

Problema que resuelve:

- No se observa un Adapter de observabilidad.
- En produccion, errores de Server Actions, RPCs, onboarding y Plataforma
  necesitan trazabilidad.

Trabajo:

1. Elegir proveedor o estrategia inicial:
   - logs estructurados;
   - error tracking;
   - dashboard del hosting;
   - Supabase logs.
2. Crear un Module pequeno, por ejemplo:
   - `src/lib/observability`
3. Definir Interface minima:
   - `captureError`
   - `logEvent`
   - `withContext` si aplica.
4. Integrar en flujos de alto riesgo:
   - Platform operations;
   - Auth/invitations;
   - appointments RPC failures;
   - delete Salon.
5. Evitar meter logica de negocio en observabilidad.
6. Documentar variables de entorno necesarias.

Archivos esperados:

- `src/lib/observability/*`
- `docs/production-readiness-checklist.md`
- `.env.local.example`
- tests si hay mapeo/error handling propio.

Criterio de terminado:

- Errores de flujos criticos quedan registrados con contexto no sensible.
- Ningun secreto ni PII innecesaria aparece en logs.
- El Adapter puede cambiar de proveedor sin tocar todos los Modules.

Riesgo: medio.

## Fase 31 - Platform Audit Log Module

Prioridad: alta antes de operar 5+ salones.

Objetivo: registrar acciones administrativas de Plataforma con trazabilidad
auditable.

Problema que resuelve:

- Plataforma puede invitar, suspender, activar/desactivar funciones, moderar
  feedback y borrar salones.
- Esas acciones son cross-tenant y algunas son irreversibles.
- Sin audit log, investigar errores humanos o soporte se vuelve dificil.

Trabajo:

1. Disenar tabla de audit log:
   - actor platform admin;
   - accion;
   - target Salon o recurso;
   - metadata minima;
   - timestamp;
   - resultado.
2. Crear migracion Supabase.
3. Crear Adapter en `src/features/platform/data`.
4. Crear use-case interno de registro o helper del Module.
5. Integrar en:
   - invite Salon;
   - update Salon features;
   - delete Salon;
   - feedback moderation;
   - suspension/activation si existe.
6. Agregar tests de use-cases para confirmar que se registra la accion.
7. Documentar en ADR 0010 si usa `service_role`.

Archivos esperados:

- `supabase/migrations/*platform_audit_log*.sql`
- `src/features/platform/data/platform-audit.repo.ts`
- `src/features/platform/use-cases/*`
- tests de plataforma
- `docs/adr/0010-server-only-admin-adapter-exceptions.md`
- `docs/database-contracts.md`

Criterio de terminado:

- Toda accion Platform de alto impacto deja audit log.
- El audit log no puede escribirse desde browser.
- Tests cubren al menos delete Salon, feature changes e invitaciones.

Riesgo: medio-alto.

## Fase 32 - Hardening De Seguridad De Produccion

Prioridad: alta.

Objetivo: cerrar seguridad operativa alrededor de headers, secrets, rate
limiting y operaciones sensibles.

Problema que resuelve:

- La base multi-tenant/RLS es fuerte, pero produccion necesita hardening
  alrededor del runtime web.
- `next.config.ts` esta vacio.
- No hay politica documentada de rate limiting ni headers.

Trabajo:

1. Revisar headers necesarios:
   - CSP si aplica;
   - frame options;
   - referrer policy;
   - permissions policy.
2. Definir politica para Server Actions sensibles:
   - invite Salon;
   - login/onboarding;
   - delete Salon;
   - generate employee invite.
3. Decidir rate limiting:
   - hosting;
   - Supabase;
   - middleware/Adapter propio.
4. Revisar `.env.local.example`.
5. Documentar manejo y rotacion de secrets.
6. Confirmar que `service_role` no aparece en cliente ni logs.

Archivos esperados:

- `next.config.ts`
- `.env.local.example`
- `docs/production-readiness-checklist.md`
- posible `docs/security.md`

Criterio de terminado:

- Headers definidos o decision documentada.
- Flujos sensibles tienen mitigacion contra abuso.
- Secrets por entorno documentados.

Riesgo: medio.

## Fase 33 - E2E Contra Staging Desplegado

Prioridad: alta.

Objetivo: validar flujos criticos contra un entorno desplegado, no solo contra
dev server local.

Problema que resuelve:

- Playwright ya cubre flujos criticos localmente.
- Produccion necesita detectar problemas de hosting, cookies, redirects,
  variables, Supabase real y configuracion de deploy.

Trabajo:

1. Configurar `E2E_BASE_URL` para staging.
2. Asegurar que fixtures temporales corren solo en staging.
3. Ejecutar suite E2E actual contra staging.
4. Agregar smoke de aceptar invitacion de Salon si el onboarding real lo exige.
5. Agregar smoke de aceptar invitacion de colaborador si el flujo va al MVP.
6. Documentar comando y variables.

Archivos esperados:

- `docs/e2e-critical-flows.md`
- `playwright.config.ts` si necesita ajuste
- posibles nuevos specs E2E
- CI workflow si se integra aqui

Criterio de terminado:

- `npm run test:e2e` puede correr contra staging con `E2E_BASE_URL`.
- No deja datos temporales.
- Falla rapido si cookies/auth/redirects del deploy estan mal.

Riesgo: medio.

## Fase 34 - Load Smoke Con Datos Realistas De 5 Salones

Prioridad: alta para lanzamiento 5+ salones.

Objetivo: comprobar que la arquitectura y los queries principales soportan un
volumen inicial realista.

Problema que resuelve:

- Los tests funcionales pasan, pero no prueban volumen.
- 5 salones con agenda, colaboradores, servicios y clientes pueden revelar N+1,
  falta de indices o pantallas lentas.

Trabajo:

1. Definir dataset realista:
   - 5 salones;
   - 5-10 colaboradores por Salon;
   - 20-50 servicios;
   - 100-500 clientes;
   - citas pasadas y futuras.
2. Crear seed controlado para staging o script manual.
3. Medir rutas criticas:
   - dashboard;
   - agenda;
   - crear cita;
   - empleados;
   - clientes;
   - reportes;
   - platform salon overviews.
4. Revisar queries lentas en Supabase.
5. Agregar indices o read models si hay evidencia.

Archivos esperados:

- `scripts/seed-staging-smoke.*` si se automatiza.
- `docs/runbooks/load-smoke-5-salons.md`
- posibles migraciones de indices.

Criterio de terminado:

- Las rutas criticas responden dentro de un umbral definido.
- No aparecen queries N+1 obvias.
- Platform overview mantiene lectura eficiente.

Riesgo: medio.

## Fase 35 - Decision Y Module De Recordatorios Reales

Prioridad: condicional.

Objetivo: decidir si recordatorios reales forman parte del lanzamiento y, si si,
crear el Module de envio sin contaminar el read Module actual.

Problema que resuelve:

- `features/reminders` hoy es read Module de cola operativa.
- Si el producto promete envio real, faltan side effects, reintentos, logs y
  Adapter externo.

Condicion:

Implementar esta fase solo si recordatorios reales son parte del MVP o del
lanzamiento con 5 salones.

Trabajo si aplica:

1. Elegir canal inicial:
   - email;
   - SMS;
   - WhatsApp;
   - manual-only.
2. Crear use-cases:
   - `send-reminder`;
   - `record-reminder-attempt`;
   - `retry-reminder`.
3. Crear Adapter externo:
   - proveedor email/SMS/WhatsApp.
4. Usar `appointment_reminder_log`.
5. Respetar `reminders.send`.
6. Agregar tests de use-case y Adapter mockeado.
7. Agregar E2E o smoke manual si el proveedor externo no se puede automatizar.

Archivos esperados:

- `src/features/reminders/use-cases/send-reminder.ts`
- `src/features/reminders/use-cases/record-reminder-attempt.ts`
- `src/features/reminders/data/reminder-log.repo.ts`
- `src/features/reminders/data/<provider>.repo.ts`
- tests relacionados
- `.env.local.example`
- docs de configuracion del proveedor

Criterio de terminado:

- El read Module actual no contiene side effects.
- El envio real queda detras de un Adapter.
- Intentos y errores quedan registrados.

Riesgo: medio-alto.

## Fase 36 - Checklist Final De Lanzamiento Y Runbooks

Prioridad: bloqueante antes de produccion.

Objetivo: tener un documento operativo unico para decidir si GlowBook puede
salir a produccion con 5+ salones.

Problema que resuelve:

- Hoy la informacion esta en auditorias, ADRs, docs de testing y README.
- Para lanzar, se necesita una lista accionable y firmable.

Trabajo:

1. Crear `docs/production-readiness-checklist.md`.
2. Incluir checklist de:
   - arquitectura;
   - tests;
   - E2E;
   - Supabase;
   - backups;
   - secrets;
   - CI/CD;
   - observabilidad;
   - rollback;
   - soporte;
   - Platform audit log.
3. Crear runbooks minimos:
   - deploy;
   - rollback;
   - restore;
   - incidente de login;
   - incidente de citas/RPC;
   - eliminar/suspender Salon.
4. Enlazar desde `docs/README.md`.

Archivos esperados:

- `docs/production-readiness-checklist.md`
- `docs/runbooks/deploy.md`
- `docs/runbooks/rollback.md`
- `docs/runbooks/database-restore.md`
- `docs/runbooks/platform-operations.md`

Criterio de terminado:

- El lanzamiento puede aprobarse con una checklist concreta.
- Cualquier persona del equipo sabe que hacer ante fallos basicos.
- No se depende de memoria individual.

Riesgo: bajo-medio.

## Orden Recomendado

```text
Fase 26  Sincronizar tipos y contrato Supabase
Fase 27  CI/CD con gates arquitectonicos obligatorios
Fase 28  Staging separado y politica de entornos
Fase 29  Backups, restore y migraciones de produccion
Fase 30  Adapter de observabilidad de produccion
Fase 31  Platform Audit Log Module
Fase 32  Hardening de seguridad de produccion
Fase 33  E2E contra staging desplegado
Fase 34  Load smoke con datos realistas de 5 salones
Fase 35  Decision y Module de recordatorios reales
Fase 36  Checklist final de lanzamiento y runbooks
```

## Mapa De Hallazgos A Fases

| Hallazgo actual | Fase |
|---|---|
| `database.types.ts` puede estar desactualizado | Fase 26 |
| Gates manuales, no obligatorios | Fase 27 |
| No hay staging formal separado | Fase 28 |
| Falta backup/restore probado | Fase 29 |
| Falta politica de migraciones en produccion | Fase 29 |
| Falta observabilidad/error tracking | Fase 30 |
| Plataforma no deja audit log de acciones sensibles | Fase 31 |
| Falta hardening web/secrets/rate limiting | Fase 32 |
| E2E corre local, falta staging deploy | Fase 33 |
| No hay prueba con datos realistas de 5 salones | Fase 34 |
| Recordatorios reales no estan implementados como envio | Fase 35 |
| Falta checklist/runbooks de lanzamiento | Fase 36 |

## Que No Hacer

- No cambiar a microservicios.
- No crear una capa global `services`.
- No crear repositorios genericos para todo Supabase.
- No mover UI local de `src/app` solo por tamano.
- No partir `session.ts` sin presion real.
- No implementar recordatorios reales si no son parte del MVP.
- No usar `service_role` para saltarse permisos normales.
- No correr fixtures E2E/RPC contra produccion.

## Primer Sprint Sugerido

El primer sprint deberia cubrir Fase 26 + Fase 27:

1. Regenerar/verificar `src/types/database.types.ts`.
2. Confirmar que `architecture:health` ya no marca tipos desactualizados o
   documentar la razon.
3. Crear CI con:
   - `npm run lint`
   - `npm run type-check`
   - `npm run test`
   - `npm run build`
4. Decidir si E2E corre en cada PR o en rama principal.
5. Actualizar `docs/README.md` con el nuevo flujo de calidad.

Este sprint tiene el mejor retorno inmediato: evita regresiones y limpia la
unica alerta tecnica actual del reporte de salud.
