# Revision De Auth Session

Fecha: 2026-05-30

Fuente: Fase 23 de `docs/architecture-audit-phases-2026-05-30.md`.

## Module Revisado

- `src/lib/auth/session.ts`
- `src/lib/auth/session.test.ts`

## Resultado

La Fase 23 queda condicionada, no ejecutada.

`session.ts` sigue siendo pequeno y su Interface publica es clara:

- `getProfile`
- `requireProfile`
- `requireActiveProfile`
- `isPlatformAdmin`
- `requirePlatformAdmin`

Aunque mezcla perfil, Salon activo y deteccion Platform admin, todavia no hay
suficiente friccion para separarlo sin crear Modules superficiales.

## Condiciones Para Reabrir

Separar este Module cuando ocurra al menos una de estas senales:

- nuevas reglas diferenciadas para owner, colaborador, platform admin o usuario
  invitado;
- mas flujos Platform que requieran verificaciones distintas;
- tests de auth con demasiados mocks;
- `session.ts` deja de ser leible como Interface de sesion.

## Separacion Recomendada Si Se Activa

- `src/lib/auth/profile-session.ts`
- `src/lib/auth/tenant-session.ts`
- `src/lib/auth/platform-session.ts`

Mantener `session.ts` como fachada pequena para no obligar a `src/app` a conocer
mas detalles internos.
