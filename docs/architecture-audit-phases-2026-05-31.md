# Fases Derivadas De La Auditoria 2026-05-31

Fecha: 2026-05-31

Fuente: `docs/architecture-audit-2026-05-31.md`

Este documento convierte la auditoria vigente en fases ejecutables. Continua
despues de la Fase 36 porque las fases anteriores ya dejaron implementada la
mayor parte del monolito modular, CI, guardrails, runbooks, audit log,
observability base y smoke tooling.

El objetivo ahora no es reestructurar GlowBook. El objetivo es cerrar la brecha
entre "el repo esta ordenado" y "el sistema tiene evidencia suficiente para
operar con 5 salones o mas".

## Estado Actual De Partida

Arquitectura interna:

```text
92% - 94% lista
6% - 8% restante
```

Readiness para 5+ salones:

```text
82% - 88% lista en repo
75% - 82% lista si faltan evidencias externas
```

## Resultado De Ejecucion 2026-05-31

| Fase | Estado | Evidencia |
|---|---|---|
| Fase 37 | parcialmente verificada, bloqueada por deploy/env staging | `npx supabase migration list` confirmo migraciones remoto/local `20240101000000`-`20240101000027`; `npm run test:e2e:staging` fallo con `Set GLOWBOOK_ENV=staging before running staging E2E.` |
| Fase 38 | bloqueada por entorno externo | Requiere backup real y destino staging/temporal para restore. |
| Fase 39 | bloqueada por entorno externo | `npm run smoke:seed-5-salons` fallo con `Set GLOWBOOK_ENV=staging...`. No se creo data. |
| Fase 40 | bloqueada por Fase 39 | No hay logs/performance de smoke real para evaluar. |
| Fase 41 | repo preparado, pendiente verificacion externa | Se documenta estrategia de logs estructurados del hosting/log drain; falta validar en deploy real. |
| Fase 42 | completada | Copy de recordatorios corregido, busqueda de mojibake limpia, `npm run lint` y `npm run type-check` pasaron. |
| Fase 43 | completada | Hotspots UI clasificados; no hay imports a Supabase/data Adapters ni Seam real que justifique extraccion. |
| Fase 44 | completada para MVP manual | Decision confirmada: `features/reminders` sigue como read Module; UI abre WhatsApp, no promete envio automatico. |
| Fase 45 | completada como gate | Decision registrada: no lanzar aun; `npm run release:readiness` bloquea hasta completar evidencia externa. |

## Principios

1. Mantener GlowBook como monolito modular feature-first.
2. Mantener `src/app` como Interface de delivery.
3. Mantener reglas de negocio en `src/features`.
4. Mantener Supabase/Postgres/Auth/RPC detras de Adapters auditables.
5. No crear Seams abstractas sin presion real.
6. Separar mejoras de codigo de evidencias externas de operacion.
7. Usar el checklist de produccion como fuente de aprobacion.
8. No cambiar arquitectura solo por estetica.

## Fase 37 - Evidencia Operativa De Staging

Prioridad: bloqueante antes de produccion.

Estado: pendiente externo.

Objetivo: demostrar que GlowBook corre correctamente en un deploy staging real,
con Supabase staging y secrets separados.

Problema que resuelve:

- El repo tiene scripts y guards, pero produccion necesita evidencia externa.
- Sin staging validado, los E2E locales no prueban cookies, hosting, redirects,
  variables reales ni conexion con Supabase desplegado.

Trabajo:

1. Confirmar que existe proyecto Supabase staging separado de production.
2. Confirmar que el hosting staging tiene:
   - `GLOWBOOK_ENV=staging`
   - `APP_URL`
   - `E2E_BASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PRODUCTION_SUPABASE_URL`
3. Aplicar migraciones en staging.
4. Ejecutar:
   - `npm run test:e2e:staging`
   - `npm run architecture:health`
5. Guardar evidencia en `docs/production-readiness-checklist.md` o en una nota
   de release.

Archivos esperados:

- `docs/production-readiness-checklist.md`
- `docs/environments.md`
- posible nota de evidencia en `docs/runbooks/deploy.md`

Criterio de terminado:

- E2E staging pasa contra deploy real.
- `architecture:health` pasa con docs, tests y E2E.
- El checklist indica fecha, entorno, comando y responsable.

Riesgo: alto si se omite.

Fuerza: Strong.

## Fase 38 - Restore Probado De Base De Datos

Prioridad: bloqueante antes de produccion.

Estado: pendiente externo.

Objetivo: comprobar que los datos pueden recuperarse antes de operar salones
reales.

Problema que resuelve:

- Un backup no probado es una promesa, no una garantia.
- Con 5 salones, perdida de datos o restore improvisado es un riesgo serio.

Trabajo:

1. Confirmar backup reciente de staging o production-like.
2. Restaurar en staging temporal o entorno seguro.
3. Verificar minimo:
   - login;
   - dashboard;
   - agenda;
   - clientes;
   - colaboradores;
   - reportes;
   - Platform overview.
4. Registrar:
   - fecha;
   - fuente del backup;
   - destino;
   - tiempo de restore;
   - comandos usados;
   - resultado;
   - responsable.
5. Actualizar checklist.

Archivos esperados:

- `docs/runbooks/database-restore.md`
- `docs/production-readiness-checklist.md`

Criterio de terminado:

- Hay una ejecucion real documentada.
- El equipo sabe cuanto tarda restaurar y como validar despues.

Riesgo: alto.

Fuerza: Strong.

## Fase 39 - Load Smoke Real Con 5 Salones

Prioridad: alta antes de produccion.

Estado: pendiente externo.

Objetivo: probar que los read Modules, Adapters y rutas principales toleran un
dataset inicial realista.

Problema que resuelve:

- Tests unitarios y E2E prueban comportamiento, no volumen.
- 5 salones con colaboradores, servicios, clientes y citas pueden mostrar N+1,
  query shape costoso o indices faltantes.

Trabajo:

1. Ejecutar seed en staging:
   - `npm run smoke:seed-5-salons`
2. Revisar rutas:
   - dashboard;
   - agenda;
   - crear cita;
   - colaboradores;
   - clientes;
   - reportes;
   - Platform overview;
   - Platform audit.
3. Registrar tiempos aproximados de carga.
4. Revisar Supabase logs para queries lentas.
5. Ejecutar cleanup:
   - `npm run smoke:cleanup-5-salons`
6. Registrar evidencia en checklist.

Archivos esperados:

- `docs/runbooks/load-smoke-5-salons.md`
- `docs/production-readiness-checklist.md`
- posibles migraciones de indices si aparece evidencia.

Criterio de terminado:

- Smoke seed se crea y se limpia sin tocar production.
- Rutas criticas responden dentro del umbral definido.
- No quedan queries lentas criticas sin decision.

Riesgo: medio-alto.

Fuerza: Strong.

## Fase 40 - Revision De Performance Y Logs Supabase

Prioridad: alta.

Estado: pendiente, depende de Fase 39.

Objetivo: decidir con evidencia si hacen falta indices, read models o ajustes de
query shape.

Problema que resuelve:

- Optimizar antes de medir puede introducir deuda.
- No revisar logs despues del smoke deja ciegos los riesgos de volumen.

Trabajo:

1. Revisar Supabase query performance despues del smoke.
2. Clasificar hallazgos por Module owner:
   - `features/appointments`
   - `features/dashboard`
   - `features/reports`
   - `features/platform`
   - `features/customers`
   - `features/employees`
3. Para cada query lenta, aplicar deletion test:
   - si la complejidad pertenece a una vista, mantener read Module;
   - si se repite en varios callers, crear o profundizar un Module;
   - si es solo persistencia, mejorar Adapter o indice.
4. Crear migracion solo si hay evidencia.
5. Actualizar `docs/database-contracts.md` si cambia un contrato SQL.

Archivos esperados:

- `docs/production-readiness-checklist.md`
- `docs/database-contracts.md` si cambia SQL.
- `supabase/migrations/*` solo si hay indices/SQL reales.

Criterio de terminado:

- Cada query lenta queda resuelta o documentada como aceptada.
- No se agregan indices preventivos sin evidencia.

Riesgo: medio.

Fuerza: Strong despues del smoke.

## Fase 41 - Observability Provider O Log Drain Real

Prioridad: alta para produccion seria.

Estado: pendiente.

Objetivo: conectar la Seam `src/lib/observability` a un destino operativo real
sin acoplar Modules de negocio a un proveedor.

Problema que resuelve:

- La Interface `captureError` y `logEvent` ya existe.
- En produccion, consola sola no alcanza para alertas, soporte ni diagnostico.

Trabajo:

1. Elegir estrategia inicial:
   - logs del hosting;
   - log drain;
   - Sentry u otro error tracking;
   - dashboard del proveedor.
2. Mantener la Interface actual del Module.
3. Cambiar solo el Adapter interno de `src/lib/observability`.
4. Confirmar que metadata sensible se sigue redacted.
5. Agregar variables en `.env.local.example` si aplica.
6. Documentar el destino en `docs/security.md` o runbook de deploy.

Archivos esperados:

- `src/lib/observability/index.ts`
- `src/lib/observability/index.test.ts`
- `.env.local.example` si aplica
- `docs/security.md`
- `docs/runbooks/deploy.md`

Criterio de terminado:

- Errores Platform y flujos criticos llegan a un destino revisable.
- No se filtran tokens, cookies, passwords ni `service_role`.
- Los Modules de negocio no importan el proveedor directamente.

Riesgo: medio.

Fuerza: Worth exploring antes de produccion; Strong si habra soporte activo.

## Fase 42 - Higiene Menor De UI Copy Y Encoding

Prioridad: baja-media.

Estado: pendiente local.

Objetivo: corregir texto visible con mojibake y evitar que el pulido de
produccion tenga errores faciles de ver.

Problema que resuelve:

- `src/app/(dashboard)/recordatorios/page.tsx` contiene una frase visible con
  encoding roto.
- No es deuda arquitectonica profunda, pero si afecta calidad percibida.

Trabajo:

1. Corregir la frase visible de recordatorios.
2. Buscar mojibake restante con un patron local de caracteres rotos conocidos.
3. Confirmar que el nuevo texto no rompe encoding.
4. Ejecutar:
   - `npm run lint`
   - `npm run type-check`

Archivos esperados:

- `src/app/(dashboard)/recordatorios/page.tsx`

Criterio de terminado:

- No queda mojibake visible.
- Lint y type-check pasan.

Riesgo: bajo.

Fuerza: Worth exploring, rapido.

## Fase 43 - Revision De Hotspots UI Route-Local

Prioridad: media.

Estado: pendiente, no bloqueante.

Objetivo: evitar que archivos grandes en `src/app` acumulen reglas de negocio
sin extraer UI por estetica.

Problema que resuelve:

- Hay archivos route-local grandes.
- El tamano no es deuda por si solo, pero puede ocultar reglas sin Locality.

Archivos a revisar:

- `src/app/(dashboard)/salon/salon-settings.tsx`
- `src/app/(dashboard)/appointments/appointments-calendar.tsx`
- `src/app/(dashboard)/services/services-manager.tsx`
- `src/app/(dashboard)/recordatorios/reminders-view.tsx`
- `src/app/(dashboard)/reports/reports-view.tsx`

Trabajo:

1. Revisar cada archivo con deletion test.
2. Clasificar cada bloque:
   - UI puramente route-local;
   - transformacion reusable;
   - regla de dominio;
   - estado complejo de pantalla;
   - query shape o Adapter leak.
3. Extraer solo si aparece una Seam real:
   - reuse en mas de una ruta;
   - tests necesarios;
   - regla de negocio;
   - Interface demasiado shallow en la pantalla.
4. Si no hay Seam real, documentar "no extraer".

Archivos esperados:

- posible actualizacion de `docs/ui-route-local-inventory-2026-05-30.md`
- posibles extracciones puntuales en `src/app/(dashboard)/*`
- posibles helpers dentro del mismo route folder.

Criterio de terminado:

- Cada hotspot queda clasificado.
- No se extrae UI solo por tamano.
- Si se extrae algo, mejora Locality o Leverage.

Riesgo: bajo-medio.

Fuerza: Worth exploring.

## Fase 44 - Decision Final De Recordatorios Reales

Prioridad: condicional.

Estado: pendiente de producto.

Objetivo: decidir si el lanzamiento promete envio real de recordatorios o solo
cola operativa/manual.

Problema que resuelve:

- `features/reminders` es read Module correcto para MVP manual.
- Si se promete envio real, faltan side effects, proveedor, retries y logs.

Trabajo si NO hay envio real:

1. Mantener `features/reminders` como read Module.
2. Asegurar copy de UI: no prometer envio automatico.
3. Mantener `docs/reminders-launch-decision.md`.

Trabajo si SI hay envio real:

1. Elegir canal inicial:
   - email;
   - SMS;
   - WhatsApp.
2. Crear use-cases:
   - `send-reminder`;
   - `record-reminder-attempt`;
   - `retry-reminder`.
3. Crear `data/reminder-log.repo.ts`.
4. Crear Adapter de proveedor.
5. Usar `appointment_reminder_log`.
6. Agregar tests de use-case y Adapter mockeado.
7. Documentar secrets del proveedor.

Archivos esperados si se implementa envio:

- `src/features/reminders/use-cases/send-reminder.ts`
- `src/features/reminders/use-cases/record-reminder-attempt.ts`
- `src/features/reminders/use-cases/retry-reminder.ts`
- `src/features/reminders/data/reminder-log.repo.ts`
- `src/features/reminders/data/<provider>.repo.ts`
- `src/features/reminders/*.test.ts`
- `.env.local.example`
- `docs/reminders-launch-decision.md`

Criterio de terminado:

- El producto sabe que promete.
- Si hay envio real, queda detras de Adapter y con logs de intentos.
- Si no hay envio real, la UI no sugiere automatizacion inexistente.

Riesgo: medio-alto si se promete envio real sin Module dedicado.

Fuerza: Condicional.

## Fase 45 - Release Readiness Gate 5+ Salones

Prioridad: bloqueante antes del primer lanzamiento real.

Estado: pendiente.

Objetivo: cerrar una decision de lanzamiento basada en evidencia, no en
sensacion.

Problema que resuelve:

- La informacion vive en docs, runbooks, CI y Supabase.
- Antes de produccion se necesita un gate unico y firmable.

Trabajo:

1. Revisar `docs/production-readiness-checklist.md`.
2. Marcar cada item con evidencia:
   - comando;
   - fecha;
   - responsable;
   - link/captura si aplica.
3. Confirmar:
   - `npm run ci:verify`
   - `npm run test:e2e:staging`
   - `npm run architecture:health`
   - restore probado;
   - smoke 5 salones;
   - audit log revisado;
   - rollback revisado;
   - soporte definido.
4. Registrar decision:
   - lanzar;
   - lanzar con condiciones;
   - no lanzar.

Archivos esperados:

- `docs/production-readiness-checklist.md`
- posible `docs/release-readiness-YYYY-MM-DD.md`

Criterio de terminado:

- Hay una decision explicita.
- No quedan bloqueantes sin owner.
- El equipo sabe como operar la primera semana.

Riesgo: alto si se omite.

Fuerza: Strong.

## Orden Recomendado

```text
Fase 42  Higiene menor de UI copy y encoding
Fase 37  Evidencia operativa de staging
Fase 38  Restore probado de base de datos
Fase 39  Load smoke real con 5 salones
Fase 40  Revision de performance y logs Supabase
Fase 41  Observability provider o log drain real
Fase 44  Decision final de recordatorios reales
Fase 43  Revision de hotspots UI route-local
Fase 45  Release readiness gate 5+ salones
```

## Mapa De Hallazgos A Fases

| Hallazgo de la auditoria 2026-05-31 | Fase |
|---|---|
| Falta evidencia de staging real | Fase 37 |
| Falta restore probado | Fase 38 |
| Falta smoke ejecutado con 5 salones | Fase 39 |
| Falta revisar logs/performance con volumen | Fase 40 |
| Observability existe, pero no hay provider/log drain real | Fase 41 |
| Hay mojibake visible en recordatorios | Fase 42 |
| Archivos UI route-local grandes requieren clasificacion, no extraccion ciega | Fase 43 |
| Recordatorios reales dependen de decision de producto | Fase 44 |
| Falta gate final de lanzamiento con evidencia firmable | Fase 45 |

## Que No Hacer

- No cambiar a microservicios.
- No crear una capa global `services`.
- No mover UI local de `src/app` solo por tamano.
- No crear Interfaces abstractas si solo existe un Adapter.
- No agregar indices sin evidencia de queries lentas.
- No conectar proveedor externo directamente desde Modules de negocio.
- No prometer recordatorios reales si solo existe cola operativa.
- No correr smoke, fixtures o E2E con service role contra production.
- No borrar ADRs vigentes.

## Primer Sprint Sugerido

El primer sprint puede ser:

1. Fase 42: corregir mojibake y correr lint/type-check.
2. Fase 37: dejar staging E2E ejecutado o, si falta acceso externo, documentar
   exactamente que secret/URL bloquea.
3. Fase 38: programar restore probado.

Razon:

- Fase 42 es rapida y mejora pulido.
- Fase 37 y Fase 38 son las que mas acercan el sistema a produccion real.
- Ninguna de estas fases cambia la arquitectura base, solo la fortalece.
