# Runbook: Database Migrations

## Objetivo

Aplicar cambios SQL/RLS/RPC sin romper el contrato TypeScript ni aislamientos
multi-tenant.

## Checklist Antes De Escribir SQL

1. Identificar Module propietario.
2. Revisar ADR relacionado.
3. Decidir autoridad: SQL, TypeScript o duplicacion permitida para UX.
4. Definir rollback o mitigacion.
5. Si toca datos reales, confirmar backup.

## Flujo

1. Crear migracion en `supabase/migrations`.
2. Revisar SQL manualmente.
3. Verificar si staging tiene migraciones pendientes:

```text
npm run staging:migrations
```

Si el comando bloquea, aplicar migraciones en staging:

```text
npm run db:migrate
```

4. Regenerar tipos:

```text
npm run db:types
```

5. Correr:

```text
npm run type-check
npm run test
npm run architecture:health
```

6. Actualizar `docs/database-contracts.md`.
7. Antes de production, verificar migraciones pendientes:

```text
npm run release:migrations
```

8. Aplicar en production solo despues de staging verde y con aprobacion explicita.

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

## RLS/RPC

Para RLS/RPC, agregar o actualizar tests cuando sea viable. Si no hay test
automatico, documentar smoke manual y evidencia.

## Rollback

- Migracion aditiva: normalmente rollback de app basta.
- Constraint o RLS restrictiva: preparar SQL de mitigacion.
- Migracion destructiva: requiere backup/restore probado.
