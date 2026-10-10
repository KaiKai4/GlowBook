# Runbook: Database Migrations

## Objetivo

Aplicar cambios SQL/RLS/RPC sin romper el contrato TypeScript, los aislamientos
multi-tenant ni la version anterior de la app que sigue en ejecucion durante un
despliegue.

Decision de fondo: [ADR 0016](../adr/0016-migraciones-forward-only-expand-contract.md).

## Politica Forward-Only

- Las migraciones aplicadas en produccion son inmutables. Un error se corrige con una
  migracion nueva.
- Un cambio incompatible se hace en tres despliegues: **expand**, migracion de datos y
  codigo, y **contract**.
- Prohibido en cualquier migracion: `RENAME COLUMN`, `RENAME TO`, `TRUNCATE`,
  `DELETE FROM` sin `WHERE`.
- `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN ... TYPE` y `SET NOT NULL` solo en una
  migracion **contract**:
  - el nombre del archivo contiene `_contract_`;
  - la primera cabecera del archivo es `-- contract-of: <id>`, con el id de la
    migracion expand que la precede y que ya existe.
- `DROP FUNCTION` solo si la misma migracion recrea la funcion.

La regla se evalua con `analyzeMigration` en `scripts/quality/migration-rules.mjs`
(funcion pura, con tests en `scripts/quality/migration-rules.test.mjs`).

### Ejemplo de renombrado seguro

1. `expand_...sql`: añadir la columna nueva (nullable) y un indice.
2. Desplegar la app que escribe en ambas columnas y lee la nueva. Backfill por lotes.
3. Desplegar la app que solo usa la nueva.
4. `..._contract_drop_legacy_column.sql` con `-- contract-of: <id del expand>`:
   `ALTER TABLE ... DROP COLUMN ...`.

## Checklist Antes De Escribir SQL

1. Identificar Module propietario.
2. Revisar ADR relacionado (0016 para cualquier cambio destructivo o de contrato).
3. Decidir autoridad: SQL, TypeScript o duplicacion permitida para UX.
4. Confirmar que la migracion es compatible con la version anterior de la app.
5. Definir rollback o mitigacion.
6. Si toca datos reales, confirmar backup.

## Flujo

1. Crear migracion en `supabase/migrations` con un nombre `YYYYMMDDHHMMSS_<descripcion>.sql`.
   Si es contract, incluir `_contract_` en el nombre y `-- contract-of: <id>` como
   primera linea.
2. Revisar SQL manualmente.
3. Verificar si staging tiene migraciones pendientes:

```text
npm run staging:migrations
```

Si el comando bloquea (salida 2 o 1), no se aplica nada a mano: las migraciones
remotas solo las aplica `.github/workflows/release.yml` (ver seccion siguiente).

4. Regenerar tipos:

```text
npm run db:types
```

5. Añadir o actualizar pgTAP para RLS, RPC y constraints tocados.
6. Correr:

```text
npm run type-check
npm run test
npm run verify:full
```

7. Actualizar `docs/database-contracts.md`.
8. Antes de production, verificar migraciones pendientes:

```text
npm run release:migrations
```

9. Aplicar en production solo despues de staging verde, con aprobacion explicita y
   mediante la automatizacion de release. Nunca editar produccion a mano.

## Guardia De Destino

Todo script que escribe en una base de datos (`seed-*`, `cleanup-*`,
`bootstrap-platform-admin`) llama a `assertSafeTargetOrExit` de
`scripts/lib/target-guard.mjs` antes de crear el cliente. Reglas:

- **Produccion nunca**: se rechaza si `GLOWBOOK_ENV=production` o si la URL es igual a
  `PRODUCTION_SUPABASE_URL` (o tiene el mismo project-ref).
- **Local** (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`): permitido sin
  confirmacion.
- **Remoto** (`https://<ref>.supabase.co`): exige `--confirm=<ref>` con el mismo ref.

Si falta el flag, el script termina con codigo 1 y muestra el ref que debe pasarse.

`bootstrap-platform-admin` acepta el mismo flag despues de email y password:

```text
node --env-file=.env.local scripts/bootstrap-platform-admin.mjs <email> <password> --confirm=<ref>
```

## Aplicar Migraciones Remotas (release.yml)

Las migraciones remotas las aplica solo `.github/workflows/release.yml` con
`scripts/release/apply-migrations.mjs`, con doble guarda. Solo se ejecuta si
`npm run release:migrations` sale con codigo 2 (pendientes) y tras la aprobacion
Production. Si sale con 1 (error o drift), la release se bloquea y no se aplica nada.
No hay comando manual para aplicar migraciones remotas (ver ADR 0022).

## Gate De Migraciones

`npm run release:migrations` compara las migraciones locales en `supabase/migrations`
contra el historial remoto de la base indicada por `PRODUCTION_DATABASE_URL`.

`npm run staging:migrations` hace lo mismo contra `STAGING_DATABASE_URL`.

Reglas:

- El comando no aplica migraciones.
- El comando no imprime la URL de base de datos.
- Si faltan migraciones remotas, bloquea el release.
- Si Supabase CLI no puede leer el historial remoto, bloquea el release.
- Para usar otra URL temporalmente, definir `SUPABASE_DB_URL`.
- Si la URL de Supabase usa pooler transaccional `6543` y el CLI falla por
  prepared statements, el gate reintenta con el mismo pooler en puerto `5432`
  modo sesion.

## Aplicar Migraciones Pendientes

Cuando el gate indique que faltan migraciones, aplicarlas antes de desplegar
codigo que depende de ellas.

Si la URL configurada usa pooler `6543`, aplicar con la misma URL cambiando el
puerto a `5432`, porque `supabase db push` puede fallar en el pooler
transaccional con `prepared statement already exists`.

Despues de aplicar, ejecutar de nuevo:

```text
npm run release:migrations
```

El resultado esperado es:

```text
[OK] Remote database has all local migration versions.
```

## Lint De Migraciones

`scripts/quality/lint-migrations.mjs` (squawk) bloquea solo las migraciones posteriores
al corte. Las reglas forward-only de la seccion de politica (`analyzeMigration`) se
integraran en ese mismo lint para las migraciones posteriores al corte; mientras tanto
se verifican en revision de PR con la plantilla de `.github/pull_request_template.md`. Una migracion que viola la
politica no se corrige editandola: se crea una migracion nueva que compensa el cambio,
o se reabre la decision con el ADR.

## RLS/RPC

Para RLS/RPC, agregar o actualizar tests cuando sea viable. Si no hay test
automatico, documentar smoke manual y evidencia en el PR.

## Rollback

- Migracion aditiva (expand): normalmente rollback de app basta.
- Constraint o RLS restrictiva: preparar SQL de mitigacion como nueva migracion.
- Contract (drop, tipo, not null): no tiene rollback de SQL. Requiere backup/restore
  probado, por eso el contract se despliega solo cuando ninguna version viva usa lo
  antiguo.
