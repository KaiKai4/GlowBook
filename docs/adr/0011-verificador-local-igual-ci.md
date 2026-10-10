# ADR 0011: Verificador Local Igual Que CI

## Estado

Aceptada. Por ADR 0031, `docs-links` y `ci-parity` se fusionan en el paso `meta`, y `code-map` sale del manifiesto (se regenera en pre-commit).

## Contexto

Antes de esta decision, CI y el desarrollo local ejecutaban cosas distintas. `ci.yml` llamaba a comandos sueltos, `npm run ci:verify` reproducia solo una parte y `architecture:health` quedaba fuera de los gates. Un cambio podia pasar en local y fallar en CI, o al reves, y nadie podia afirmar con certeza que "lo verificado en local" era "lo que CI exige".

Ademas, algunos controles (E2E, migraciones, tipos generados) dependian de secretos de staging o de un entorno remoto. Eso hacia que la verificacion local fuera incompleta sin que el desarrollador lo notara.

## Decision

Existe un unico manifiesto de pasos de calidad:

```text
scripts/quality/steps.mjs
```

Cada paso declara `id`, `tier` (`fast` o `full`), `jobs` de CI a los que pertenece, `description`, `cmd` (argv sin shell) y `needsDb` cuando requiere Supabase local.

El runner es:

```text
scripts/quality/verify.mjs
```

Comandos publicos:

```text
npm run verify:fast   # tier fast: estatico + unit
npm run verify:full   # tier full: fast + auditoria, BD local, build, E2E, Lighthouse
npm run verify:job -- <job>   # todos los pasos de un job de CI
```

Reglas:

- `verify:full` es la definicion de terminado local. Debe estar verde en un checkout limpio.
- Cada job de `.github/workflows/ci.yml` ejecuta un unico paso `npm run verify:job -- <job>`. CI no tiene comandos propios fuera del manifiesto.
- `check-ci-parity` falla si un paso del manifiesto no aparece en ningun job de CI, o si un job de CI ejecuta herramientas de calidad sueltas fuera de `verify`. Esto mantiene la paridad aunque alguien edite el YAML.
- Los pasos con `needsDb` llaman antes a `ensureLocalSupabase()` y reciben el entorno local con `getLocalSupabaseEnv()`. Nunca apuntan a staging ni a produccion.
- Los hooks de git llaman al mismo manifiesto: `pre-commit` ejecuta `secrets` y `lint`; `pre-push` ejecuta `verify:fast`.
- CodeQL es el unico control que solo corre en CI. Queda documentado y no se simula en local.

## Consecuencias

Un fallo de CI siempre se puede reproducir localmente con el mismo comando y el mismo paso.

Anadir un control nuevo exige declararlo en el manifiesto. Si no esta en el manifiesto, no existe para CI ni para el verificador.

`verify:full` requiere Docker para la base local y tarda mas que un lint. Por eso existe `verify:fast` como ciclo diario, y el hook de `pre-push` usa el tier rapido.

No se usan dos listas paralelas de comandos. Si CI y local divergen, el fallo esta en `steps.mjs` o en `check-ci-parity`, no en la documentacion.
