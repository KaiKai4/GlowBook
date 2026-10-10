# ADR 0026: Runner pgTAP propio y Supabase local sin analytics

- **Estado**: Aceptada
- **Fecha**: 2026-10-10

## Contexto

El paso `db-tests` y `npm run db:test` ejecutaban `supabase test db` (CLI de Supabase 2.120.0). En Windows con Docker Desktop 29.x el CLI se cuelga indefinidamente tras imprimir "Connecting to local database...", justo al lanzar el contenedor de `pg_prove`. Además, en esa máquina los montajes bind (`-v`) de Docker Desktop no devuelven nunca, con o sin espacios en la ruta, así que el CLI no puede compartir `supabase/tests` con el contenedor.

Un segundo problema es `Vector` (el agente de analytics de Supabase local). En Docker Desktop para Windows se reinicia en bucle, y `supabase start` se queda esperando a que el servicio esté sano. Las pruebas no usan analytics ni logs, así que el servicio solo bloquea el arranque.

Un cuelgue de pruebas sin tiempo máximo deja el verificador bloqueado y no da señal útil, lo que contradice la [ADR 0011](0011-verificador-local-igual-ci.md) y la regla de que las pruebas de integración fallan, no se saltan.

## Decisión

1. **Runner propio.** `scripts/quality/run-pgtap.mjs` replica lo que hace `supabase test db`:
   - instala la extensión `pgtap` en la base del stack local;
   - crea un contenedor `pg_prove` (imagen `public.ecr.aws/supabase/pg_prove:3.36`) en la red `supabase_network_<project_id>`;
   - copia `supabase/tests` dentro del contenedor con `docker cp` (sin montajes bind), lo arranca con `docker start -a` y comprueba su código de salida.
   - Usa `docker` con argumentos separados (sin shell) y un tiempo máximo por comando. Solo usa las credenciales del stack local.
2. **El paso `db-tests` del verificador y `npm run db:test`** llaman a ese runner (`scripts/quality/steps.mjs`, `package.json`).
3. **Analytics desactivado** en `supabase/config.toml` (`[analytics]`). Las pruebas no leen logs de Supabase.
4. El runner tiene pruebas propias con `node:test` en el paso `scripts-tests`.

## Consecuencias

- El mismo runner se usa en local (Windows) y en CI (Linux). Así el resultado de `db-tests` no depende de la máquina.
- Si se actualiza el CLI de Supabase, hay que revisar la versión de la imagen `pg_prove` (`PG_PROVE_IMAGE` en el runner) para que siga coincidiendo con la que usa el CLI.
- Volver a `supabase test db` es un cambio de una línea en `scripts/quality/steps.mjs` (y en `package.json`), siempre que el CLI deje de colgarse en la máquina donde se use.
- Desactivar `[analytics]` no afecta a Auth, RLS ni a los hooks de JWT, que son los componentes que sí prueban las pruebas pgTAP. Si en el futuro se necesitan logs locales, hay que reactivarlo con un cambio explícito en `supabase/config.toml`.
- El runner es código propio que mantener. Su alcance se limita a ejecutar pgTAP: no sustituye al CLI para otros comandos.
