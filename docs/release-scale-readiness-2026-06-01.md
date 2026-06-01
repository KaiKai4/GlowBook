# Decision De Readiness Para Lanzamiento Amplio

Fecha: 2026-06-01

Scope: lanzamiento nacional / muchos salones reales.

## Decision Actual

Decision actual: No-Go para lanzamiento amplio.

Esto no significa que el sistema este mal para piloto. Significa que el
monolito modular y los gates tecnicos ya tienen buena base, pero todavia falta
evidencia operativa externa antes de abrirlo a muchos salones del pais.

## Etapas

```text
Piloto 5-10 salones: permitido con gate MVP actual.
Crecimiento 25-50 salones: condicionado a staging correcto y revision de logs.
Lanzamiento amplio 100+ salones: no permitido hasta cerrar bloqueos externos.
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

1. Vercel staging embebe Supabase production.
2. Falta repetir E2E negativo contra staging desplegado corregido.
3. Falta medir rutas criticas con dataset de escala en Vercel corregido.
4. Falta revisar Vercel Logs despues de esas mediciones.
5. Falta confirmar limites finos de Supabase/Vercel desde dashboard.
6. Falta confirmar proveedor/log drain y alertas reales.
7. Falta confirmar canales de soporte y guardia de primera semana.
8. Falta decidir y validar rate limiting operativo para rutas publicas.
9. Falta probar CSP report-only en staging.
10. Falta practicar o agendar rotacion de secrets si aplica.

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

Corregir las variables de entorno del deployment staging en Vercel para que
usen el proyecto Supabase staging, redeployar y ejecutar:

```text
npm run release:scale-readiness
```

Cuando ese gate pase sin bloqueos y las confirmaciones esten firmadas, esta
decision puede cambiar de No-Go a Go por etapa.
