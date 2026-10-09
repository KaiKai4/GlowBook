# ADR 0014: Base De Datos De Pruebas Con Supabase Local

## Estado

Aceptada.

## Contexto

Las pruebas de integracion y RPC del proyecto se apoyaban en Supabase remoto. Eso tenia tres problemas:

- Las pruebas dependian de credenciales y de un proyecto compartido. Un fallo podia significar un problema de red o de secretos, no del codigo.
- Un test podia escribir en staging, lo que contradice la politica de entornos en `docs/environments.md`.
- Las migraciones se validaban al aplicarlas, no antes. Un cambio que bloqueaba tablas en produccion solo se detectaba cuando ya estaba desplegado.

Ademas, los tipos generados (`src/types/database.types.ts`) podian quedar desalineados de las migraciones sin que nada lo detectara.

## Decision

La base de datos de pruebas es Supabase local, levantado con Docker y el CLI de Supabase:

```text
npm run db:start   # levanta el stack local (idempotente)
npm run db:reset   # reconstruye la BD desde supabase/migrations
npm run db:test    # ejecuta pruebas pgTAP
```

Puertos locales declarados en `supabase/config.toml`: API `55421`, DB `55422`, nombre de proyecto `glowbook`.

Reglas:

1. Las pruebas de SQL usan pgTAP en `supabase/tests/`. Cubren RLS, aislamiento por salon, permisos, la funcion de creacion de citas y los privilegios de funciones `security definer`.
2. Las pruebas de integracion (`*.rpc.test.ts` y `*.integration.test.ts`) corren en el proyecto `integration` de Vitest. Si falta el entorno local, deben fallar. No se saltan.
3. El entorno de pruebas se obtiene de `getLocalSupabaseEnv()` y no de `.env.local`. Los tests de integracion no cargan `.env.local`.
4. Las migraciones son forward-only. Una migracion ya aplicada en produccion no se modifica. Los cambios se hacen con una migracion nueva.
5. `squawk` bloquea solo las migraciones posteriores a `20240101000063`, que es la ultima aplicada en produccion. Las anteriores se informan por regla, sin fallar.
6. Los tipos se generan desde la BD local con `npm run db:types`. El paso `types-drift` compara el archivo versionado con los tipos que genera la BD local y falla si hay diferencias de tipos o columnas. No regenera el archivo.
7. Staging y produccion no se usan en el flujo de calidad. Los scripts `staging:*`, `release:*` y `db:types:staging` quedan fuera del verificador.

## Consecuencias

Las pruebas son reproducibles en cualquier maquina con Docker, sin credenciales compartidas.

Un fallo de RLS o de una funcion SQL se detecta antes de desplegar.

Requiere Docker. Sin Docker, `verify:full` falla de forma explicita en lugar de saltarse los pasos de BD.

Diferencias de emision entre el CLI de Supabase y el archivo versionado pueden aparecer como deriva aunque no cambien tablas ni columnas. En ese caso, la regeneracion del archivo es un cambio separado y revisado, no parte del paso de calidad.
