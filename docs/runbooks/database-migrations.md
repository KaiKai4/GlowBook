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
3. Aplicar en staging:

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
7. Aplicar en production solo despues de staging verde.

## RLS/RPC

Para RLS/RPC, agregar o actualizar tests cuando sea viable. Si no hay test
automatico, documentar smoke manual y evidencia.

## Rollback

- Migracion aditiva: normalmente rollback de app basta.
- Constraint o RLS restrictiva: preparar SQL de mitigacion.
- Migracion destructiva: requiere backup/restore probado.
