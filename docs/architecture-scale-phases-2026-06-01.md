# Fases De Escalamiento Arquitectonico Y Produccion Nacional

Fecha: 2026-06-01

Fuente: `docs/architecture-audit-2026-06-01.md`

Skill usada: `improve-codebase-architecture`

## Objetivo

Estas fases convierten la auditoria vigente en trabajo accionable para pasar de
un MVP validado con 5+ salones a un sistema preparado para muchos salones reales
en produccion.

Importante:

- Las fases 37-45 ya cerraron readiness para MVP/piloto controlado.
- Este documento no contradice ese cierre.
- Estas fases son para escalar confianza: mas carga, mas salones, mas soporte,
  mas seguridad operativa y mas evidencia multi-tenant.

## Estado De Partida

Orden arquitectonico actual:

```text
96% - 98% listo
2% - 4% restante
```

Readiness tecnica actual para 5+ salones:

```text
93% - 96% listo
4% - 7% restante
```

Readiness estimada para lanzamiento amplio con muchos salones:

```text
84% - 90% lista
10% - 16% restante
```

Lectura:

El monolito modular esta bien implementado. Lo que falta para un lanzamiento
masivo no es reescribir, sino probar y operar bajo escenarios mas grandes:
aislamiento multi-tenant agresivo, volumen, observability avanzada, backups con
datos grandes, limites de proveedores y soporte.

## Principios

1. Mantener GlowBook como monolito modular feature-first.
2. Mantener `src/app` como Interface de delivery.
3. Mantener reglas de negocio en `src/features`.
4. Mantener Supabase/Postgres/Auth/RPC detras de Adapters auditables.
5. Mantener RLS como autoridad final multi-tenant.
6. No crear Seams hipoteticas sin presion real.
7. Usar datos y pruebas antes de optimizar.
8. Separar readiness de codigo de readiness operativa.
9. No prometer recordatorios automaticos sin Module de envio real.
10. No avanzar a lanzamiento amplio sin evidencia de rollback, restore y logs.

## Fase 46 - Baseline De Release Nacional

Prioridad: bloqueante antes de escalar fuera del piloto.

Estado: implementada como checklist y gate. La decision aprobada actual es
`controlled-growth`; lanzamiento amplio queda como decision separada de
upgrade operativo.

Objetivo: definir el punto de control para pasar de MVP 5+ salones a
lanzamiento amplio.

Problema que resuelve:

- El gate actual valida el piloto, pero un lanzamiento nacional requiere
  evidencia adicional.
- Sin baseline, es facil confundir "tests pasan" con "operacion preparada".

Trabajo:

1. Crear checklist de lanzamiento amplio.
2. Separar criterios:
   - piloto 5-10 salones;
   - crecimiento 25-50 salones;
   - lanzamiento amplio 100+ salones.
3. Definir umbrales minimos:
   - tasa de errores;
   - latencia aceptable;
   - RTO/RPO;
   - capacidad de soporte;
   - limites Supabase/Vercel.
4. Documentar decision go/no-go por etapa.
5. Alinear `release:readiness` o crear nuevo script `release:scale-readiness`.

Archivos esperados:

- `docs/production-scale-readiness-checklist.md`
- `docs/release-readiness-2026-05-31.md`
- `scripts/release-readiness.mjs` o `scripts/release-scale-readiness.mjs`

Criterio de terminado:

- Existe un gate separado para lanzamiento amplio.
- Queda claro que 5 salones y 100+ salones no usan el mismo nivel de evidencia.

Evidencia implementada:

- `docs/production-scale-readiness-checklist.md`
- `docs/release-scale-readiness-2026-06-01.md`
- `scripts/release-scale-readiness.mjs`
- `npm run release:scale-readiness`
- `release:scale-readiness` ejecuta subgates no destructivos:
  - `staging:verify-env`;
  - `observability:readiness`;
  - `capacity:readiness`;
  - `security:readiness`;
  - `support:readiness`.
- `npm run baseline:readiness` valida el documento go/no-go de lanzamiento
  amplio y puede exigir firma operativa con variables de entorno.

Fuerza: Strong.

## Fase 47 - Pruebas Agresivas De Aislamiento Multi-Tenant

Prioridad: bloqueante antes de muchos salones.

Estado: completada para `controlled-growth`; E2E negativo ejecutado contra
staging y guard de Supabase desplegado verificado.

Objetivo: demostrar que un Salon no puede leer, modificar ni inferir datos de
otro Salon por UI, Server Actions, RPCs, reportes ni rutas directas.

Problema que resuelve:

- La arquitectura multi-tenant esta bien disenada, pero un lanzamiento amplio
  necesita pruebas negativas mas agresivas.
- RLS protege la base, pero hay que comprobar que las Interfaces de app no
  filtran datos por errores de caller o query shape.

Trabajo:

1. Crear fixtures de dos o mas salones con datos similares.
2. Probar intentos cruzados:
   - abrir URLs con IDs de otro Salon;
   - editar cliente de otro Salon;
   - crear cita usando servicio/colaborador de otro Salon;
   - leer reportes de otro Salon;
   - acceder a Platform sin superadmin;
   - usar funciones deshabilitadas por URL directa.
3. Agregar tests RLS/RPC donde aplique.
4. Agregar E2E negativo para rutas criticas.
5. Registrar hallazgos en `docs/database-contracts.md`.

Archivos esperados:

- `e2e/multi-tenant-isolation.spec.ts`
- `src/test/supabase-integration-fixtures.ts`
- tests RPC/RLS en `src/features/*`
- `docs/database-contracts.md`

Criterio de terminado:

- Hay pruebas automatizadas que intentan romper aislamiento.
- Los tests pasan contra staging.
- Cualquier excepcion queda documentada en ADR o contrato SQL.

Evidencia implementada:

- `e2e/multi-tenant-isolation.spec.ts` intenta acceder desde Salon A a detalle
  de colaborador y cita de Salon B, y comprueba que Platform no queda
  disponible para owner de Salon.
- `npm run test:e2e` paso con 16/16 tests incluyendo el nuevo spec.
- `npm run test:e2e:staging` paso con 16/16 tests contra
  `glow-book-git-main-kai-book.vercel.app`, con Supabase staging verificado:
  `vifuurgquxkkpqqobigr.supabase.co`.
- `npm run test -- src/features/appointments/use-cases/create-appointment.rpc.test.ts src/features/platform/data/salon-overviews.rpc.test.ts`
  paso con 2 archivos y 5 tests RPC/RLS criticos.
- `docs/database-contracts.md` registra la evidencia de aislamiento y acceso
  Platform-only.
- `npm run isolation:readiness` valida que el E2E negativo, tests RPC/RLS,
  contratos de base de datos y guard de staging sigan presentes.
- `docs/runbooks/vercel-staging-env.md` documenta como corregir el bloqueo de
  Supabase mismatch en Vercel antes de repetir E2E staging.

Fuerza: Strong.

## Fase 48 - Dataset De Escala 50/100/250 Salones

Prioridad: alta.

Estado: completada para 25/50/100 salones con seed/cleanup parametrizable.
250 salones queda como prueba opcional si el crecimiento real lo exige.

Objetivo: extender el smoke actual de 5 salones para simular volumen realista.

Problema que resuelve:

- 5 salones valida el MVP.
- 50+ salones puede revelar N+1, indices faltantes, consultas pesadas y limites
  de plan.

Trabajo:

1. Crear seed parametrizable:
   - salones;
   - colaboradores por Salon;
   - servicios por Salon;
   - clientes por Salon;
   - citas por Salon;
   - rango de fechas.
2. Mantener confirmaciones humanas para evitar production.
3. Crear cleanup seguro por batch.
4. Probar datasets:
   - 25 salones;
   - 50 salones;
   - 100 salones;
   - opcional 250 salones.
5. Guardar resultados por batch.

Archivos esperados:

- `scripts/seed-staging-scale.mjs`
- `scripts/cleanup-staging-scale.mjs`
- `docs/runbooks/load-smoke-5-salons.md` o nuevo
  `docs/runbooks/load-scale-salons.md`
- `docs/production-scale-readiness-checklist.md`

Criterio de terminado:

- Se puede crear y limpiar un dataset de escala sin tocar production.
- Cada batch deja evidencia de conteos y cleanup.

Evidencia implementada:

- `scripts/seed-staging-scale.mjs`
- `scripts/cleanup-staging-scale.mjs`
- `npm run dataset:readiness`
- `npm run scale:seed-salons`
- `npm run scale:cleanup-salons`
- `docs/runbooks/load-scale-salons.md`
- Batch `scale-20260601-25` creado y limpiado en staging:
  - 25 salones;
  - 25 owners;
  - 200 colaboradores;
  - 125 categorias;
  - 750 servicios;
  - 3750 clientes;
  - 3000 citas;
  - cleanup elimino 25 salones y 25 auth users.
- Batch `scale-20260601-50` creado y limpiado en staging:
  - 50 salones;
  - 50 owners;
  - 400 colaboradores;
  - 250 categorias;
  - 1500 servicios;
  - 7500 clientes;
  - 6000 citas;
  - cleanup elimino 50 salones y 50 auth users.
- Batch `scale-20260601-100` creado y limpiado en staging:
  - 100 salones;
  - 100 owners;
  - 800 colaboradores;
  - 500 categorias;
  - 3000 servicios;
  - 15000 clientes;
  - 12000 citas;
  - cleanup elimino 100 salones y 100 auth users.

Fuerza: Strong.

## Fase 49 - Performance Y Query Review Con Volumen

Prioridad: alta.

Estado: completada para `controlled-growth`; Supabase advisors paso con 100
salones y rutas criticas fueron medidas contra Preview staging. Revision
manual de Vercel Logs/log drain avanzado queda como criterio de lanzamiento
amplio.

Objetivo: comprobar que rutas criticas responden con volumen y que Supabase no
reporta issues importantes.

Problema que resuelve:

- Los tests funcionales no miden latencia ni costos.
- Reports, dashboard, appointments y Platform overview son candidatos a queries
  pesadas.

Trabajo:

1. Ejecutar dataset de Fase 48.
2. Medir rutas:
   - `/`;
   - `/appointments`;
   - `/appointments/new`;
   - `/customers`;
   - `/employees`;
   - `/services`;
   - `/reports`;
   - `/admin`;
   - `/admin/salons`;
   - `/admin/audit`.
3. Revisar Vercel Logs:
   - latencia;
   - errores 5xx;
   - timeouts;
   - Function Invocation duration.
4. Revisar Supabase advisors/logs.
5. Crear migraciones de indices solo con evidencia.
6. Actualizar `docs/database-contracts.md` si cambia SQL/RPC.

Archivos esperados:

- `docs/performance-review-YYYY-MM-DD.md`
- `supabase/migrations/*` solo si hay evidencia real.
- `docs/database-contracts.md`

Criterio de terminado:

- No hay queries criticas sin decision.
- Las rutas principales tienen tiempos aceptables con dataset de escala.
- Cualquier indice nuevo esta justificado.

Evidencia implementada:

- `docs/performance-review-2026-06-01.md`
- checklist de rutas y decisiones de indices.
- `scripts/measure-scale-routes.mjs`
- `npm run performance:readiness`
- `npm run scale:measure-routes`
- `performance:readiness` puede exigir confirmacion granular de Vercel Logs
  con `GLOWBOOK_PERFORMANCE_REQUIRE_VERCEL_LOG_REVIEW=true`.
- Batch `scale-20260601-route-100` midio rutas criticas contra Preview staging:
  10/10 rutas respondieron 200; maximo observado 874 ms en `/admin/salons`;
  cleanup elimino 100 salones y 100 auth users.
- Supabase performance advisors con batch `scale-20260601-100` reporto
  `No issues found`.

Fuerza: Strong.

## Fase 50 - Observability Avanzada Y Alertas

Prioridad: alta antes de muchos salones.

Estado: gate/documentacion implementados y confirmados para
`controlled-growth`; proveedor/log drain y alerta real quedan como criterio si
se decide lanzamiento amplio.

Objetivo: pasar de logs visibles en Vercel a observability operable con
retencion, busqueda y alertas.

Problema que resuelve:

- Vercel Logs sirve para MVP, pero soporte nacional necesita historico,
  alertas, busqueda y diagnostico rapido.

Trabajo:

1. Elegir proveedor/log drain:
   - Sentry;
   - Better Stack;
   - Axiom;
   - Datadog;
   - otro.
2. Usar la Seam existente `src/lib/observability`.
3. Configurar:
   - `GLOWBOOK_OBSERVABILITY_WEBHOOK_URL`;
   - `GLOWBOOK_OBSERVABILITY_WEBHOOK_TOKEN`.
4. Confirmar redaccion de secretos.
5. Crear alerta minima:
   - errores 500;
   - errores Platform;
   - fallos de Supabase;
   - latencia elevada.
6. Documentar retencion y acceso.

Archivos esperados:

- `src/lib/observability/index.ts`
- `src/lib/observability/index.test.ts`
- `.env.local.example`
- `docs/security.md`
- `docs/runbooks/deploy.md`

Criterio de terminado:

- Errores reales llegan al destino.
- No se filtran tokens, cookies, passwords ni `service_role`.
- Hay al menos una alerta revisable.

Evidencia implementada:

- `release:scale-readiness` exige `SCALE_OBSERVABILITY_CONFIRMED=true`.
- `docs/security.md` documenta log drain y secretos.
- `src/lib/observability` redacciona metadata, error message y stack.
- `npm run observability:readiness` valida Adapter/test y puede exigir webhook
  real con `GLOWBOOK_OBSERVABILITY_REQUIRE_WEBHOOK=true`.
- `observability:readiness` puede exigir alertas minimas y retencion con
  `GLOWBOOK_OBSERVABILITY_REQUIRE_ALERTS=true`.

Fuerza: Strong para lanzamiento amplio.

## Fase 51 - Capacity Plan Supabase/Vercel

Prioridad: alta.

Estado: documento implementado con planes observados, fuentes oficiales y
decision operativa para `controlled-growth`; upgrade/backup/log drain quedan
como criterio de lanzamiento amplio.

Objetivo: saber que limites de plan, conexiones, funciones, ancho de banda y
base de datos aplican antes de crecer.

Problema que resuelve:

- Que la arquitectura sea correcta no garantiza que el plan contratado soporte
  el trafico.

Trabajo:

1. Documentar plan actual de Vercel.
2. Documentar plan actual de Supabase.
3. Revisar limites:
   - conexiones Postgres;
   - pooler;
   - storage;
   - bandwidth;
   - Function duration;
   - logs retention;
   - backups;
   - Auth rate limits.
4. Definir umbrales para subir de plan.
5. Revisar si conviene activar pooling o ajustar configuracion.

Archivos esperados:

- `docs/capacity-plan.md`
- `docs/environments.md`
- `docs/runbooks/deploy.md`

Criterio de terminado:

- El equipo sabe cuantos salones/usuarios espera soportar con el plan actual.
- Hay senales claras para subir de plan.

Evidencia implementada:

- `docs/capacity-plan.md`
- `npm run capacity:readiness` valida plan, umbrales, evidencia de escala y
  separacion Supabase staging/production. Puede exigir limites reales del
  dashboard con `GLOWBOOK_CAPACITY_REQUIRE_CONFIRMED_LIMITS=true`.

Fuerza: Strong.

## Fase 52 - Backup/Restore Con Dataset Grande

Prioridad: bloqueante antes de muchos datos reales.

Estado: completada con restore de 100 salones staging -> local.

Objetivo: repetir el restore probado, pero con volumen cercano al lanzamiento
amplio.

Problema que resuelve:

- El restore con 5 salones prueba el procedimiento.
- Un restore con 50/100+ salones prueba tiempo, costo y riesgos reales.

Trabajo:

1. Crear dataset de escala en staging.
2. Dump/backup del dataset.
3. Restore en entorno local/temporal.
4. Medir:
   - tiempo de dump;
   - tiempo de restore;
   - validacion de conteos;
   - errores;
   - pasos manuales.
5. Definir RTO/RPO objetivo.
6. Actualizar runbook.

Archivos esperados:

- `docs/runbooks/database-restore.md`
- `docs/production-scale-readiness-checklist.md`

Criterio de terminado:

- Hay evidencia de restore con dataset grande.
- Se conoce el tiempo estimado de recuperacion.

Evidencia implementada:

- `docs/runbooks/database-restore.md` incluye procedimiento para batch de
  escala y RTO/RPO.
- `npm run restore:readiness` valida evidencia de restore smoke, restore
  grande, cleanup y plantilla RTO/RPO. Puede exigir RTO/RPO de negocio con
  `GLOWBOOK_RESTORE_REQUIRE_BUSINESS_RTO_RPO=true`.
- Batch `scale-restore-20260601-100` creado en staging con:
  - 100 salones;
  - 100 owners;
  - 800 colaboradores;
  - 500 categorias;
  - 3000 servicios;
  - 15000 clientes;
  - 12000 citas.
- Dump data-only de `auth,public` creado desde staging.
- Restore local ejecutado con `psql -v ON_ERROR_STOP=1`.
- Validacion local post-restore:
  - `scale_salons=100`;
  - `scale_customers=15000`;
  - `scale_employees=800`;
  - `scale_appointments=12000`;
  - `scale_auth_users=100`.
- Cleanup staging elimino 100 salones y 100 auth users.
- Supabase local fue reseteado y apagado despues de la prueba.

Fuerza: Strong.

## Fase 53 - Seguridad Operativa: Rate Limits, CSP Y Secrets

Prioridad: alta.

Estado: decision/documentacion implementada y gate de seguridad pasado para
`controlled-growth`; confirmacion operativa estricta de rate limits/CSP/secrets
queda como criterio de lanzamiento amplio.

Objetivo: endurecer seguridad para exposicion publica amplia.

Problema que resuelve:

- Con muchos salones aumenta superficie de abuso: login, invitaciones, feedback
  y acciones Platform.

Trabajo:

1. Revisar rutas publicas:
   - login;
   - invite;
   - join;
   - feedback;
   - signout.
2. Definir rate limiting inicial con hosting/Supabase o Adapter propio.
3. Evaluar CSP en modo report-only.
4. Documentar rotacion de secrets.
5. Confirmar que `service_role` no aparece en logs ni bundle cliente.
6. Revisar headers en Vercel.

Archivos esperados:

- `docs/security.md`
- `docs/runbooks/deploy.md`
- posible `src/lib/rate-limit/*` si aparece presion real.
- `next.config.ts` si se ajustan headers/CSP.

Criterio de terminado:

- Hay decision explicita de rate limiting.
- Secrets tienen plan de rotacion.
- CSP queda decidida o aplazada con razon.

Evidencia implementada:

- `docs/security.md` documenta rate limiting para lanzamiento amplio, CSP y
  rotacion de secrets.
- `next.config.ts` soporta CSP report-only con `GLOWBOOK_CSP_REPORT_ONLY=true`.
- `npm run rate-limit:readiness` valida que la decision y rutas publicas
  sensibles esten documentadas, y puede exigir confirmacion real de proveedor
  con `GLOWBOOK_RATE_LIMIT_REQUIRE_PROVIDER_CONFIRMATION=true`.
- `npm run security:readiness` valida headers desplegados y que
  `SUPABASE_SERVICE_ROLE_KEY` no aparezca en artefactos publicos/estaticos.
- `security:readiness` puede exigir confirmacion operativa de CSP, rotacion de
  secrets y log scan con `GLOWBOOK_SECURITY_REQUIRE_OPERATION_CONFIRMATION=true`.

Fuerza: Worth exploring / Strong antes de publicidad amplia.

## Fase 54 - Soporte, Incidentes Y Operacion De Primera Semana

Prioridad: alta.

Estado: runbook implementado y gate de soporte pasado para
`controlled-growth`; canales formales y owner suplente quedan como criterio de
lanzamiento amplio.

Objetivo: preparar operacion humana para muchos salones reales.

Problema que resuelve:

- El software puede estar bien, pero un lanzamiento amplio falla si no hay
  proceso de soporte, incidentes y rollback.

Trabajo:

1. Definir owner de soporte por semana.
2. Crear matriz de incidentes:
   - login caido;
   - Supabase lento;
   - citas no se crean;
   - Salon suspendido por error;
   - datos cruzados sospechados;
   - reportes lentos.
3. Definir tiempos de respuesta.
4. Definir pasos de rollback.
5. Crear plantilla de postmortem.
6. Documentar canales de comunicacion.

Archivos esperados:

- `docs/launch-support.md`
- `docs/runbooks/rollback.md`
- `docs/runbooks/platform-operations.md`
- `docs/runbooks/incidents.md`

Criterio de terminado:

- El equipo sabe que hacer ante incidentes comunes.
- Hay owner, canal y criterio de escalamiento.

Evidencia implementada:

- `docs/runbooks/incidents.md`
- `docs/launch-support.md` ampliado para lanzamiento amplio.
- `npm run support:readiness` valida owner, runbooks, matriz de incidentes,
  postmortem y puede exigir canales/guardia reales con
  `GLOWBOOK_SUPPORT_REQUIRE_CONFIRMED_CHANNELS=true`.

Fuerza: Strong.

## Fase 55 - Recordatorios Automaticos Solo Si Entran Al Producto

Prioridad: condicional.

Estado: completada como decision MVP manual; si cambia producto, abrir fase de
Module de envio.

Objetivo: evitar prometer envio automatico sin Module profundo, Adapter externo
y trazabilidad.

Problema que resuelve:

- `features/reminders` hoy es read Module manual.
- Si el producto promete WhatsApp/SMS/email automatico, la arquitectura actual
  necesita un nuevo Module de side effects.

Trabajo si NO se promete envio automatico:

1. Mantener `features/reminders` como read Module.
2. Mantener UI como flujo manual.
3. Mantener `docs/reminders-launch-decision.md`.

Trabajo si SI se promete envio automatico:

1. Crear use-cases:
   - `send-reminder`;
   - `record-reminder-attempt`;
   - `retry-reminder`.
2. Crear Adapter de proveedor.
3. Usar `appointment_reminder_log`.
4. Agregar tests unitarios y de Adapter mockeado.
5. Documentar secrets del proveedor.
6. Agregar observability para fallos de envio.

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

Evidencia implementada:

- Decision actual: no prometer envio automatico.
- `release:scale-readiness` exige confirmar que esta decision fue revisada.
- `npm run reminders:readiness` valida que la decision manual siga vigente y
  que no exista codigo de envio automatico accidental en `features/reminders`.

Fuerza: Condicional.

## Orden Recomendado

```text
Fase 46  Baseline de release nacional
Fase 47  Pruebas agresivas de aislamiento multi-tenant
Fase 48  Dataset de escala 50/100/250 salones
Fase 49  Performance y query review con volumen
Fase 50  Observability avanzada y alertas
Fase 51  Capacity plan Supabase/Vercel
Fase 52  Backup/restore con dataset grande
Fase 53  Seguridad operativa: rate limits, CSP y secrets
Fase 54  Soporte, incidentes y operacion de primera semana
Fase 55  Recordatorios automaticos si entran al producto
```

## Primer Sprint Recomendado

1. Fase 46: crear el checklist/gate de lanzamiento amplio.
2. Fase 47: agregar pruebas negativas multi-tenant.
3. Fase 48: crear seed/cleanup parametrizable para 50+ salones.

Razon:

- Sin baseline no sabemos cuando parar.
- Sin pruebas multi-tenant agresivas no conviene abrir el producto a muchos
  salones.
- Sin dataset grande no hay forma honesta de hablar de performance.

## Que No Hacer

- No migrar a microservicios por miedo a escala.
- No optimizar queries sin evidencia.
- No crear Interfaces abstractas si solo existe un Adapter.
- No borrar ADRs vigentes.
- No ejecutar seeds de escala contra production.
- No usar `service_role` para saltarse reglas normales de Salon.
- No prometer recordatorios automaticos sin Module de envio.
- No confundir Vercel Logs basico con observability completa para soporte
  nacional.

## Definicion De Terminado Del Roadmap

Este roadmap se considera cerrado cuando:

1. Hay gate separado para lanzamiento amplio.
2. Hay pruebas multi-tenant negativas automatizadas.
3. Hay dataset de escala parametrizable y cleanup seguro.
4. Hay performance review con volumen y decisiones de indices.
5. Hay observability con alertas o decision documentada equivalente.
6. Hay capacity plan Supabase/Vercel.
7. Hay restore probado con dataset grande.
8. Hay plan de seguridad operativa.
9. Hay runbook de incidentes y soporte.
10. Recordatorios automaticos estan decididos: manual o Module real de envio.

Estado de cierre al 2026-06-01:

- Cerrado para `controlled-growth`: `npm run release:scale-readiness` paso con
  42 OK / 0 bloqueos y decision aprobada `controlled-growth`.
- No cerrado para lanzamiento amplio nacional: requiere decision nueva de
  upgrade operativo, observability/log drain formal, soporte formal y revision
  de capacidad del plan antes de campanas publicas.
