# ADR 0016: Migraciones Forward-Only Con Expand/Contract

## Estado

Aceptada.

## Contexto

GlowBook sirve a salones reales en produccion. Durante un despliegue conviven dos
versiones de la aplicacion: la anterior, que sigue atendiendo trafico hasta que
Vercel completa el cambio, y la nueva. Si una migracion elimina o renombra algo que
la version anterior todavia usa, el despliegue rompe reservas, cobros o aislamiento
multi-tenant durante la ventana de solapamiento.

Ademas, las migraciones ya aplicadas en produccion no se pueden reescribir ni revertir
de forma segura: el historial remoto es la fuente de verdad (ver el gate
`release:migrations`). Un rollback de SQL destructivo requiere restaurar backup, que es
caro y pierde datos escritos despues.

Hace falta una regla simple, verificable en CI y que no dependa de la memoria de quien
escribe la migracion.

## Decision

1. **Forward-only.** Las migraciones aplicadas en produccion son inmutables. Un
   error se corrige con una migracion nueva, nunca editando una existente.
2. **Expand/contract.** Un cambio incompatible se divide en tres pasos desplegables
   por separado:
   - **Expand**: migracion aditiva y compatible con la version anterior de la app
     (columnas nullable o con default, tablas nuevas, indices concurrentes, funciones
     nuevas). Se despliega primero.
   - **Migrar datos y codigo**: la app nueva escribe en ambas formas y lee la nueva.
     Backfill por lotes, sin `DELETE` masivo ni `TRUNCATE`.
   - **Contract**: migracion que elimina lo antiguo (`DROP COLUMN`, `DROP TABLE`,
     `ALTER COLUMN ... TYPE`, `SET NOT NULL`). Solo se despliega cuando ninguna version
     viva usa lo antiguo.
3. **Prohibido siempre**: `RENAME COLUMN`, `RENAME TO`, `TRUNCATE`, `DELETE FROM` sin
   `WHERE`. Renombrar es un expand (columna nueva) seguido de un contract (drop de la
   antigua).
4. **Operaciones de contract solo en migraciones identificadas.** El nombre debe
   contener `_contract_` y la primera cabecera debe ser
   `-- contract-of: <id>`, donde `<id>` es una migracion existente que hizo el expand.
   La regla queda codificada en `scripts/quality/migration-rules.mjs`.
5. **DROP FUNCTION** solo si la misma migracion recrea la funcion (`CREATE OR REPLACE`).
6. **Escrituras remotas acotadas.** Los scripts que escriben en una base remota exigen
   `--confirm=<project-ref>` y rechazan produccion (`scripts/lib/target-guard.mjs`).
   Las migraciones remotas se aplican solo desde `.github/workflows/release.yml` con
   `scripts/release/apply-migrations.mjs`, con doble guarda. El estado se comprueba con
   `npm run release:migrations` (`scripts/production-migration-gate.mjs`, salidas 0, 1 y 2;
   ver [ADR 0022](0022-retiro-tooling-staging-pricing-readiness-stryker.md)).

## Consecuencias

- Positivas: un despliegue fallido de la app se revierte solo con codigo; no hace falta
  restaurar backup para la mayoria de cambios; la politica se verifica en CI.
- Negativas: un cambio que antes era una migracion ahora son dos o tres despliegues y
  mas tiempo. Las columnas viejas conviven durante un tiempo y hay que mantener la
  escritura doble mientras dure la ventana.
- Coste aceptado: `DROP` real de datos llega solo en un contract posterior, con su
  propia revision.

## Alternativas descartadas

- **Migraciones reversibles (`down`)**: no son seguras con datos escritos tras la
  migracion. Descartadas.
- **Permitir renombrar con `ALTER ... RENAME`**: rompe la version anterior de la app
  al instante. Descartado.
- **Confiar solo en revision manual**: no escala y no deja rastro verificable. Se
  mantiene la revision, pero la regla basica la aplica el lint.

## Relacionado

- ADR 0011 (verificador local igual a CI) y ADR 0015 (excepciones de auditoria).
- `docs/runbooks/database-migrations.md` describe el procedimiento operativo.
