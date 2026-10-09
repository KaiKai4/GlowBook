# Decision De Readiness Para Lanzamiento Amplio

Fecha: 2026-06-01

Scope: lanzamiento nacional / muchos salones reales.

## Decision Actual

Decision actual: Go para crecimiento controlado; No-Go para campana nacional
masiva.

Esto significa que GlowBook puede operar con piloto y crecimiento controlado
usando Supabase Free + Vercel Hobby mientras el volumen sea bajo y exista
monitoreo cercano. No significa que ya sea correcto abrir campanas publicas
masivas sin upgrade de plan, log retention/log drain, soporte externo y
observability avanzada.

## Etapas

```text
Piloto 5-10 salones: permitido con gate MVP actual.
Crecimiento controlado 25-50 salones: permitido con revision semanal de logs,
errores, limits y soporte.
Lanzamiento amplio 100+ salones/campana nacional: no permitido hasta upgrade o
decision explicita de capacidad, observability, seguridad y soporte.
```

## Evidencia Tecnica Disponible

- Arquitectura modular feature-first vigente en `src/features`.
- `src/app` se mantiene como Interface de delivery.
- Supabase/Postgres/Auth/RPC quedan detras de Adapters auditables.
- Dataset 25/50/100 salones creado y limpiado en staging.
- Restore de 100 salones probado en local desde dump de staging.
- Supabase performance advisors con dataset de 100 salones: `No issues found`.
- Gates no destructivos disponibles para dataset, performance, observability,
  capacity, restore, security, support y reminders.
- `npm run ci:verify` paso con lint, type-check, tests y build.

## Bloqueos Para Lanzamiento Amplio

Para crecimiento controlado, estos puntos quedan aceptados como decisiones con
seguimiento. Para campana nacional masiva siguen siendo bloqueantes:

1. Log drain/error tracking y alertas reales.
2. Upgrade o confirmacion explicita de capacidad Supabase/Vercel.
3. Canal externo de soporte y guardia de primera semana.
4. Rate limiting operativo para rutas publicas.
5. CSP report-only probado en staging.
6. Rotacion de secrets practicada o agendada si aplica.

Bloqueos resueltos el 2026-06-01:

- Vercel Preview staging ya embebe Supabase staging.
- `npm run test:e2e:staging` paso con 16/16 tests.
- Las rutas criticas fueron medidas con dataset de 100 salones y respondieron
  10/10 con status 200.

## Variables De Confirmacion

El gate de lanzamiento amplio exige estas variables solo cuando cada evidencia
ya fue revisada por una persona responsable:

```text
SCALE_BASELINE_CONFIRMED=true
SCALE_ISOLATION_CONFIRMED=true
SCALE_DATASET_CONFIRMED=true
SCALE_PERFORMANCE_CONFIRMED=true
SCALE_OBSERVABILITY_CONFIRMED=true
SCALE_CAPACITY_CONFIRMED=true
SCALE_RESTORE_CONFIRMED=true
SCALE_SECURITY_CONFIRMED=true
SCALE_SUPPORT_CONFIRMED=true
SCALE_REMINDERS_DECISION_CONFIRMED=true
```

Para exigir una decision firmada en el gate baseline:

```text
GLOWBOOK_BASELINE_REQUIRE_SIGNED_DECISION=true
GLOWBOOK_SCALE_DECISION_OWNER=<responsable>
GLOWBOOK_SCALE_DECISION_DATE=2026-06-01
GLOWBOOK_SCALE_DECISION_APPROVED_STAGE=<pilot|growth|broad-launch>
```

## Accion Siguiente

Evidencia actual:

```text
npm run release:scale-readiness
Summary: 42 ok, 0 blocked
Scale release decision: controlled-growth gate passed; broad launch remains a separate upgrade decision.
```

Antes de campanas publicas masivas, cambiar la decision a `broad-launch` solo
si capacity, observability, security y support ya tienen evidencia operativa
real o upgrade aplicado.
