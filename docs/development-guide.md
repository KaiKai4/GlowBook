# Guia De Desarrollo

Flujo diario para trabajar en GlowBook en local: preparar el entorno, levantar la base de datos, cambiar el esquema, escribir pruebas y entregar un cambio. Las reglas que deben cumplirse están en `AGENTS.md`; esta guía explica cómo cumplirlas.

Documentos relacionados: `AGENTS.md` (reglas), `docs/quality-guide.md` (verificador), `docs/testing.md` (pruebas y BD local), `docs/database-contracts.md` (contratos de BD), `CONTEXT.md` (vocabulario).

## 1. Requisitos

- Node 24 (versión fijada en `.nvmrc`).
- Docker en ejecución, para la base de datos local de Supabase.
- Dependencias del lockfile: `npm ci`. Ni `npm install` ni actualizaciones de dependencias forman parte de un cambio funcional; las dependencias cambian en un cambio dedicado.
- Chromium de Playwright para E2E: `npx playwright install chromium`.
- La CLI de Supabase va como dependencia de desarrollo (`supabase` en `package.json`). Se usa con `npx supabase`.

`npm ci` instala también los hooks de Husky (`prepare`).

## 2. Configuración Local

1. Copia `.env.local.example` a `.env.local` y rellena sus seis variables básicas. Los secretos de deploy van en GitHub, no en esta plantilla. `.env.local` está en `.gitignore` y nunca se versiona.
2. Para verificar en local no hace falta `.env.local`: la BD local se obtiene del stack de Supabase local y el verificador no lee secretos de staging ni de producción.
3. Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` en variables `NEXT_PUBLIC_*` ni en código de navegador (ver `SECURITY.md`).

Variables públicas y de servidor principales: `GLOWBOOK_ENV`, `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. La sexta variable es `PRODUCTION_SUPABASE_URL`, una guarda de pruebas. La configuración opcional de observabilidad y operación se documenta en `docs/security.md` y los runbooks; no es necesaria para arrancar el entorno local.

## 3. Base De Datos Local

```text
npm run db:start     # levanta Supabase local (idempotente)
npm run db:reset     # reconstruye la BD desde supabase/migrations y supabase/seed.sql
npm run db:test      # pruebas pgTAP de supabase/tests (runner scripts/quality/run-pgtap.mjs, ADR 0023)
npm run db:types     # regenera src/types/database.types.ts desde la BD local
```

Reglas de la BD local:

- Hay un stack local por máquina. Si cambias de checkout, para el stack desde el checkout que lo arrancó (`npx supabase stop`) y vuelve a levantarlo desde el nuevo. `docs/testing.md` explica el motivo y el mensaje de `ensureLocalSupabase`.
- Puertos declarados en `supabase/config.toml`: API `55421`, base de datos `55422`.
- Si `db:start` falla, revisa que Docker esté en ejecución.

## 4. Cambiar El Esquema

Las migraciones son forward-only y siguen expand/contract (ADR 0016). Pasos:

1. Identifica el módulo dueño del cambio en `docs/database-contracts.md` y el ADR relacionado.
2. Crea una migración nueva en `supabase/migrations/` con el formato `YYYYMMDDHHMMSS_nombre.sql`, con una fecha posterior a la última existente. Nunca edites una migración ya aplicada en producción.
3. Respeta las prohibiciones: sin `RENAME`, `TRUNCATE` ni `DELETE FROM` sin `WHERE`. Renombrar es un expand seguido de un contract en otra migración.
4. Aplica en local con `npm run db:reset`.
5. Añade o actualiza pruebas pgTAP en `supabase/tests/` si cambian RLS, RPC, permisos o integridad.
6. Regenera tipos con `npm run db:types` y revisa el diff de `src/types/database.types.ts`. No lo edites a mano.
7. Ejecuta `npm run verify:full` antes de dar el cambio por terminado. Incluye `migrations-lint`, `db-tests` y `types-drift`.

La plantilla de PR tiene una checklist específica para migraciones (`.github/pull_request_template.md`).

## 5. Estructura De Un Módulo

Al añadir o cambiar un módulo en `src/features/<modulo>/`:

- `schemas.ts`: DTOs Zod de entrada y salida.
- `domain/`: funciones puras, sin I/O, sin Next, sin Supabase, sin React. Solo si hay reglas reales que probar.
- `data/`: repositorios Supabase y llamadas RPC. Un módulo nunca importa el `data/` de otro.
- `use-cases/`: orquestación: valida, aplica reglas, persiste. Es la interfaz que usan las rutas.
- `index.ts`: interfaz pública. Otros módulos importan solo desde aquí.

En `src/app/`, las Server Actions solo exigen sesión, comprueban permisos con `has_permission`, parsean la entrada, llaman a un use-case y revalidan. La lógica de negocio no va en componentes ni en Server Actions.

Antes de crear carpetas nuevas, usa los nombres de `CONTEXT.md`.

### Convención de nombres

- **Casos de uso** (`use-cases/`): el nombre describe la operación con un verbo o el concepto (`record-expense.ts`, `parse-role-input.ts`). No llevan sufijos `-guarded`, `-flow`, `-flows`, `-writes` ni `-form`. Si un archivo contiene reglas de negocio (p. ej. cupos de plan), se llama `*-checks.ts` o por su operación, no por el mecanismo.
- **Flujos de acción** (el pipeline de `defineAction`): viven en los `actions*.ts` de `src/app`, con su nombre de módulo. No se crean archivos `*-flow.ts` aparte.
- **Parseo de entrada** (FormData o campos crudos): `parse-*-input.ts` o `*-input.ts`, con funciones `parse*`.
- **Variables**: `result` para un valor `Result<T>` y `formData` para un `FormData`. No uses `res`, `r`, `outcome`, `fd` ni `form` para estos tipos.
- **Unidades de tiempo**: nombres completos (`hours`, `minutes`, `seconds`), nunca una letra (`h`, `m`, `s`).

## 6. Pruebas

| Tipo | Ubicación | Comando |
|---|---|---|
| Unitarias | `src/**/*.test.ts(x)` (sin `*.rpc.test.ts` ni `*.integration.test.ts`) | `npm run test` |
| Integración (BD local) | `src/**/*.rpc.test.ts`, `src/**/*.integration.test.ts` | `npm run test:integration` |
| pgTAP | `supabase/tests/*.sql` | `npm run db:test` (runner `scripts/quality/run-pgtap.mjs`) |
| Scripts | `scripts/**/*.test.mjs` con `node:test` | `node --test <archivo>` (el verificador ejecuta la lista completa) |
| E2E | `e2e/*.spec.ts` | `npm run test:e2e` |
| Cobertura | Vitest con v8 | `npm run test:coverage` |

Principios:

- Las pruebas cruzan la interfaz pública del módulo y describen conducta observable. Evita probar detalles internos.
- Una regla crítica (RLS, permisos, idempotencia, citas, errores públicos) siempre tiene prueba.
- Una corrección de bug incluye una prueba que falla antes del cambio.
- Las pruebas de integración fallan si falta la BD local. No se marcan como saltadas.
- Umbrales y trinquetes: ver `docs/quality-guide.md`.

Para ejecutar solo las pruebas de un cambio mientras iteras:

```text
npx vitest run --project unit --maxWorkers=2 <rutas>
```

## 7. Interfaz De Usuario

- Tokens semánticos de `DESIGN.md`. No uses clases de paleta cruda ni colores literales: el paso `design-tokens` lo comprueba.
- Tipografía según `DESIGN.md` §4. Usa `font-semibold` en lugar de `font-bold`.
- Revisa el resultado a 375 px sin scroll horizontal, con gutter lateral de 16 px.

## 8. Hooks Y Verificación

- `pre-commit` ejecuta `secrets` y `lint` sobre el commit.
- `pre-push` ejecuta `npm run verify:fast`.
- Antes de entregar: `npm run verify:full` en un checkout limpio con Docker en marcha.

Los hooks no sustituyen `verify:full`. No se usa `--no-verify` para saltarlos.

## 9. Commits Y Pull Requests

- Rama nueva desde `main`. Nunca se trabaja directamente en `main`.
- Commits en español con formato `tipo(ámbito): mensaje` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`).
- Pull request con la plantilla de `.github/pull_request_template.md`. La evidencia de pruebas incluye el comando y su resultado.
- Un cambio de arquitectura, de contrato de datos o de herramientas incluye un ADR en `docs/adr/`.
- El workflow `GlowBook CI` (`.github/workflows/ci.yml`) debe estar en verde antes de fusionar. El despliegue lo gestiona `docs/production-standard.md`.

## 10. De La Rama A Producción

1. Con el checkout limpio, actualizar main y crear una rama:

   ```bash
   git switch main
   git pull --ff-only
   git switch -c feat/nombre-del-cambio
   ```

2. Con Docker abierto, ejecutar `npm run db:start` y `npm run dev`. Desarrollar y probar contra Supabase local. Las migraciones se añaden al repositorio, no se aplican manualmente a producción.
3. Durante el cambio usar `npm run verify:fast`; antes de entregarlo, completar `npm run verify:full` en un checkout limpio. Los hooks no se saltan.
4. Preparar los archivos, revisar `git diff --cached`, hacer commit en español y subir la rama. Ejemplo: `git commit -m "feat(agenda): permitir filtrar citas"` y `git push -u origin feat/nombre-del-cambio`.
5. Abrir un PR hacia main con evidencia de verificación. Esperar los siete controles obligatorios de CI y revisar el cambio antes de integrarlo.
6. Tras el merge, CI vuelve a comprobar el SHA de main. Su éxito dispara GlowBook Release; un push a una rama no hace deploy en Vercel.
7. Aprobar las migraciones en Production. Después del despliegue candidato y su smoke, aprobar la promoción al dominio público. Seguir los botones y criterios de `docs/runbooks/deploy.md`.
8. Confirmar la release en verde y el monitor de producción. Staging remoto y Nightly no forman parte de este flujo.

## 11. Comandos De Uso Diario

```bash
npm run dev            # servidor de desarrollo de Next.js
npm run lint           # ESLint con cero avisos
npm run type-check     # TypeScript sin emitir
npm run test           # Vitest, proyecto unit
npm run verify:fast    # ciclo diario completo
npm run verify:full    # definición de terminado
```

Los comandos que apuntan a staging o producción (`staging:*`, `release:*`, `*:seed-*`, `*:cleanup-*`, `pricing:*`, `bootstrap:admin`, `db:migrate`) no son de desarrollo diario. Están descritos en `docs/environments.md` y en los runbooks.
