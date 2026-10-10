# ADR 0022: Retiro de tooling de staging, pricing, readiness y Stryker

- **Estado**: Aceptada
- **Fecha**: 2026-10-10

Esta decisión supera parcialmente la [ADR 0012](0012-toolchain-de-calidad.md): retira Stryker y los scripts de readiness que esa ADR daba de alta.

## Contexto

La [ADR 0021](0021-deploy-sin-staging-remoto.md) retiró staging remoto obligatorio, los workflows Nightly y el monitor de staging. Los scripts que servían a esos entornos quedaron sin consumidor: no los ejecutaba CI, ni la release, ni el verificador local, y se mantenían contra un entorno que ya no existe.

Había unas 4.450 líneas de tooling sin uso, entre ellas:

- scripts `*-readiness.mjs` (baseline, capacidad, dataset, aislamiento, observabilidad, rendimiento, rate limit, recordatorios, restauración, seguridad, soporte, release y release a escala);
- scripts de siembra, limpieza y medición de staging y de benchmark de precios (`seed-*`, `cleanup-*`, `measure-*`, `pricing-benchmark-*`, `pricing-study-*`) y sus librerías en `scripts/lib/`;
- `db-push-guarded.mjs`, que duplicaba `scripts/release/apply-migrations.mjs`;
- `verify-deployed-staging-env.mjs`, `generate-staging-database-types.mjs`, `require-staging-e2e-env.mjs` y `deployed-supabase-check.mjs`;
- la configuración de Stryker (`stryker.config.mjs` y `@stryker-mutator/*`), que solo corría a mano.

Además, `pg` y `playwright` dejaron de ser dependencias de scripts: los E2E usan `@playwright/test`.

Aplicar el principio de YAGNI exige borrar lo que no tiene consumidor. Mantenerlo solo añade superficie de dependencias y de revisión, y da una falsa sensación de control.

## Decisión

1. **Se borra** el tooling listado en el contexto y sus pruebas (`scripts/**/*.test.mjs` asociados), junto con `stryker.config.mjs` y las dependencias `@stryker-mutator/*`, `pg` y `playwright`.
2. **Se retiran de `package.json`** los scripts `staging:verify-env`, `*:readiness`, `release:readiness`, `release:scale-readiness`, `test:e2e:staging`, `db:types:staging`, `db:migrate`, `smoke:*`, `scale:*` y `pricing:*`. Se conservan `release:migrations`, `staging:migrations` y `bootstrap:admin`.
3. **Cada control útil se sustituye por un control vigente**, para que ninguna garantía se pierda:

| Lo retirado | Control que lo sustituye |
|---|---|
| Readiness de seguridad (secretos de cliente) | Paso del verificador `bundle-secrets` (tier full, tras `build`): busca la clave `service_role` en `.next/static` y `public`. |
| Readiness de aislamiento entre salones | Pruebas pgTAP `supabase/tests/01_tenant_isolation.sql` y `supabase/tests/05_rate_limit.sql`. |
| Comprobación de cabeceras y CSP en remoto | E2E de cabeceras de seguridad: `e2e/security-headers.spec.ts`. |
| Mutación con Stryker (solo manual) | Trinquete de cobertura (ADR 0013) y pruebas de conducta que crucen la interfaz pública (ADR 0008). |

4. **Contrato del gate de migraciones** (`scripts/production-migration-gate.mjs`, comando `npm run release:migrations`). Sale con:
   - `0`: el historial remoto está al día; no hay nada que aplicar.
   - `2`: hay migraciones pendientes. `release.yml` las aplica solo con este código.
   - `1`: error de ejecución o drift (versiones que solo existen en remoto). Bloquea la release y no aplica nada.

5. **Aplicación de migraciones remotas.** Solo `.github/workflows/release.yml` aplica migraciones, con `scripts/release/apply-migrations.mjs` y su doble guarda. No existe ningún comando manual `db:migrate`.

6. **Recuperar un script retirado.** El historial de git conserva todo. Para ver un archivo tal como estaba en `main`:

   ```bash
   git show main:scripts/<archivo>
   ```

   Para localizar cuándo se borró y en qué commit:

   ```bash
   git log --diff-filter=D --name-only -- scripts/
   ```

   Un script recuperado vuelve a necesitar su paso en `scripts/quality/steps.mjs` y su propia decisión registrada en un ADR nuevo antes de integrarse.

## Consecuencias

- Se elimina alrededor de 4.450 líneas de código y dependencias sin consumidor. El árbol de dependencias de desarrollo es más pequeño y las auditorías tienen menos superficie.
- Las garantías de seguridad, aislamiento y cabeceras siguen cubiertas, ahora por controles que corren en CI y en el verificador local.
- Se pierde la mutación automática con Stryker. Su valor queda cubierto de forma parcial por el trinquete de cobertura y por las pruebas de conducta. Si en el futuro se quiere medir mutación, debe volver con un ADR propio que justifique su coste.
- Cualquier script retirado se recupera desde git con los comandos del punto 6, pero no vuelve a integrarse sin su paso y su ADR.
- La ADR 0012 queda parcialmente superada. Sus demás decisiones de toolchain siguen vigentes.
