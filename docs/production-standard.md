# Estandar De Produccion

Este documento describe cómo se publica, se observa y se opera GlowBook en producción. Define qué controlan los workflows, qué comprueba cada etapa de la release y dónde están los procedimientos de operación. No duplica los runbooks: los enlaza.

Decisiones relacionadas: ADR 0011 (verificador igual a CI), ADR 0014 (BD de pruebas local), ADR 0016 (migraciones forward-only), ADR 0017 (rate limit compartido), ADR 0018 (errores públicos).

## 1. Principio

Producción solo recibe código que ya pasó `verify:full` en CI. La release no vuelve a pasar los controles de calidad: verifica que el CI del SHA esté en éxito y despliega. Ningún cambio se aplica a mano en producción: todo entra por migraciones versionadas y por el workflow de release.

## 2. Workflows

| Workflow | Disparo | Qué hace |
|---|---|---|
| `ci.yml` (GlowBook CI) | Push y pull request | Jobs `static`, `unit`, `db`, `browser`, `lighthouse`, `sbom` y `codeql`. Cada job llama a `npm run verify:job -- <job>`. |
| `release.yml` (GlowBook Release) | `workflow_run` de CI en éxito sobre `main`, o manual con un SHA de `main` | Etapas en orden: `gate`, `migrations` (production, con aprobación), `deploy-staged`, `smoke-staged`, `discard-staged` (solo si falla el smoke staged), `promote` (production, con aprobación), smoke de producción, rollback del frontend y alerta si falla tras promover. |
| `synthetic.yml` (GlowBook Synthetic) | Cada hora, en el minuto 23, y manual | Check sintético de disponibilidad en solo lectura contra producción y staging. Si falla, envía alerta y abre un issue con la etiqueta `synthetic-failure`. |
| `nightly.yml` (GlowBook Nightly) | Programado y manual | Mutación con Stryker (`src/features/*/domain` y `src/lib/security`), deriva de dependencias (`npm outdated` y auditoría completa), deriva de esquema y sintético. |

Los secretos y el environment `production` (revisores y protección de despliegues) se configuran según `docs/runbooks/deploy.md`.

## 3. Etapas De La Release

1. **gate**: comprueba que el CI del SHA esté en éxito. No vuelve a ejecutar calidad.
2. **migrations**: lista las migraciones pendientes, las aplica con el gate `release:migrations` (`scripts/production-migration-gate.mjs --target=production`) y comprueba que no quedan pendientes. Requiere aprobación.
3. **deploy-staged**: despliega el build sin asignar dominio de producción.
4. **smoke-staged**: comprobaciones contra el despliegue staged.
5. **discard-staged**: si el smoke falla, elimina el despliegue staged.
6. **promote**: promueve el despliegue staged a producción. Requiere aprobación.
7. **smoke de producción**: comprobaciones contra el dominio de producción.
8. **rollback y alerta**: si el smoke falla tras promover, vuelve al despliegue anterior y avisa.
9. **notify-failure**: avisa si falla cualquier etapa anterior a `promote`.

Migraciones: forward-only con expand/contract (ADR 0016). Si una migración aplicada causa un problema, el remedio es una migración nueva, no editar la existente. El procedimiento está en `docs/runbooks/database-migrations.md`.

## 4. Sintéticos

- Comprobación horaria de disponibilidad, en solo lectura (`scripts/quality/synthetic-check.mjs`).
- Alertas: `scripts/ops/synthetic-alert-cli.mjs` envía el aviso sin secretos.
- Procedimiento de respuesta, falsos positivos y cambio de umbrales: `docs/runbooks/synthetic-checks.md`.
- Verificación local sin red externa: los tests `scripts/ops/synthetic-check.test.mjs` y `scripts/ops/synthetic-alert.test.mjs` corren en el paso `scripts-tests`.

## 5. Observabilidad

- La observabilidad es el adaptador `src/lib/observability`. Emite eventos y errores como JSON estructurado a consola, sanitizando claves sensibles (`redaction.ts`) e incluyendo el request id de `src/lib/observability/request-id.ts`.
- En el primer despliegue, los logs salen por el hosting (stdout y stderr) o por un log drain.
- Opcionalmente, el mismo adaptador envía los payloads sanitizados a un webhook: `GLOWBOOK_OBSERVABILITY_WEBHOOK_URL` (y su token). La retención y las alertas se configuran con las variables `GLOWBOOK_OBSERVABILITY_*` de `.env.local.example`.
- Los errores se registran con `captureError`. Lo que ve el usuario sigue las reglas de errores públicos de `AGENTS.md`, sección 9.
- Detalle en `docs/security.md`, sección "Observability".

## 6. Rate Limit Y Seguridad En Produccion

- Rate limit compartido en Postgres (`rate_limit_buckets` y la RPC `consume_rate_limit`, solo `service_role`), accedido desde `src/lib/security/rate-limit.ts` (ADR 0017). Si el almacén falla, la política es fail-open con `captureError`.
- Cabeceras estáticas en `next.config.ts`. CSP con nonce por petición y reporte de CSP. Detalle en `docs/security.md` y `SECURITY.md`.
- Auditoría de dependencias: `audit-prod` sin excepciones y `audit-all` con excepciones vigentes (ADR 0015).

## 7. Operacion

| Necesidad | Documento |
|---|---|
| Desplegar | `docs/runbooks/deploy.md` |
| Volver atrás | `docs/runbooks/rollback.md` |
| Restaurar la base de datos | `docs/runbooks/restore.md` |
| Responder a un incidente | `docs/runbooks/incident.md` |
| Migraciones | `docs/runbooks/database-migrations.md` |
| Operaciones de plataforma | `docs/runbooks/platform-operations.md` |
| Checks sintéticos | `docs/runbooks/synthetic-checks.md` |
| Staging de Vercel y Supabase | `docs/runbooks/vercel-staging-env.md` |
| Carga de 5 salones | `docs/runbooks/load-smoke-5-salons.md` |
| Carga de escala | `docs/runbooks/load-scale-salons.md` |
| Entornos, guardas y rotación de secretos | `docs/environments.md` |

Los scripts de operación (`smoke:*`, `scale:*`, `pricing:*`, `bootstrap:admin`, `staging:*`, `release:*`) apuntan a entornos remotos. Se ejecutan solo desde los runbooks, bajo la política de `docs/environments.md`, nunca desde el verificador ni desde pruebas.

## 8. Capacidad Y Preparacion

- Plan de capacidad: `docs/capacity-plan.md`.
- Checklists de preparación: `docs/production-readiness-checklist.md` y `docs/production-scale-readiness-checklist.md`.
- Los snapshots de revisiones fechadas están en `docs/archive/readiness-snapshots/` y solo sirven como trazabilidad.

## 9. Criterios Para Declarar Una Release Lista

- CI en éxito sobre el SHA de `main`.
- Migraciones pendientes aplicadas en producción y sin pendientes tras la etapa `migrations`.
- Smoke de staging y de producción en verde.
- Sin alertas abiertas de sintéticos (`synthetic-failure`) del último ciclo.
- Runbooks vigentes para lo que cambia (despliegue, migración o restauración).
