# Auditoria Completa De Arquitectura - Estado Actual 2026-06-01

Skill usada: `improve-codebase-architecture`.

## Objetivo

Auditar GlowBook completo, carpeta por carpeta, para confirmar:

1. Que arquitectura real esta usando el proyecto.
2. Que tan bien esta implementada como monolito modular.
3. Que deuda tecnica o riesgos siguen abiertos.
4. Si lo detectado en auditorias/fases anteriores sigue resuelto.
5. Que falta antes de usar Preview/Staging como laboratorio seguro y antes de
   un lanzamiento amplio.

Vocabulario aplicado:

- **Module**: unidad de negocio con Interface e Implementation.
- **Interface**: contrato que el caller conoce.
- **Implementation**: detalle interno del Module.
- **Seam**: punto estable donde se cambia comportamiento sin tocar callers.
- **Adapter**: Implementation concreta detras de una Seam.
- **Depth**: cuanto valor queda detras de una Interface pequena.
- **Locality**: que los cambios de un concepto vivan cerca.
- **Deletion test**: extraer solo cuando borrar un archivo dispersaria reglas
  reales, no solo JSX.

## Veredicto Ejecutivo

La arquitectura de codigo esta en buen estado.

GlowBook sigue correctamente organizado como:

```text
Next.js App Router + monolito modular feature-first + Supabase como Adapter
de persistencia/Auth/RLS/RPC.
```

El codigo, tests y build estan sanos. Durante esta auditoria se encontro un
riesgo operativo en Preview/Staging: el deployment configurado en `.env.local`
estaba apuntando, en runtime desplegado, al Supabase de produccion. Ese riesgo
fue corregido despues de ajustar variables de Vercel Preview y redeploy.

Produccion esta correcta:

```text
https://glow-book-chi.vercel.app
-> eokiklkgutzrkhbamglf.supabase.co
```

Preview/Staging quedo verificado para pruebas seguras:

```text
https://glow-book-git-main-kai-book.vercel.app
-> vifuurgquxkkpqqobigr.supabase.co
```

Conclusion: produccion y Preview/Staging vuelven a estar separados. Las pruebas
de laboratorio deben seguir ejecutandose solo contra Preview/Staging.

## Evidencia Ejecutada

```text
git status --short --branch
## main...origin/main
```

```text
npm run architecture:check
Architecture guardrails passed.
```

```text
npm run ci:verify
lint OK
architecture guardrails OK
type-check OK
52 test files passed
148 tests passed
next build OK
```

```text
npm run release:scale-readiness
42 OK / 0 blocked
Preview/Staging desplegado detecta Supabase staging.
```

```text
Produccion verificada:
glow-book-chi.vercel.app -> eokiklkgutzrkhbamglf.supabase.co
```

## Arquitectura Actual

Flujo esperado y observado:

```text
src/app
  -> rutas, layouts, Server Actions, UI route-local

src/features/<module>
  -> use-cases, domain, schemas, data Adapters, view-models

src/lib
  -> auth/session, auth/permissions, Supabase clients, observability, utils

supabase/migrations
  -> RLS, RPCs, constraints, triggers y contratos SQL

scripts
  -> gates de arquitectura, staging, escala, seguridad, soporte y release
```

La dependencia principal mantiene direccion sana:

```text
app -> features/use-cases -> features/domain + features/data -> lib/supabase
```

No se detectaron imports directos desde `src/app` o `src/components` hacia
`@/features/*/data`. Esto preserva el Adapter boundary.

Las carpetas `domain` no reportaron dependencias a Supabase, Next, React ni
`server-only`.

Los usos privilegiados de Supabase Admin/Auth Admin estan localizados en:

- `src/features/platform/data/*`
- `src/features/employees/data/*`

Esto coincide con ADR 0010: excepciones server-only detras de Adapters.

## Auditoria Carpeta Por Carpeta

### `src/app`

Rol correcto: delivery Interface.

Contiene:

- rutas publicas de auth;
- rutas dashboard;
- rutas platform admin;
- Server Actions;
- UI route-local.

Estado: bueno.

No se detecto violacion de capa hacia `features/*/data`. Las paginas llaman
use-cases, schemas, permisos y session helpers. La UI grande sigue siendo
route-local, lo cual es aceptable mientras no acumule reglas reutilizables.

Riesgo residual: archivos UI grandes como `appointments-calendar.tsx`,
`services-manager.tsx`, `salon-settings.tsx`, `reports-view.tsx` y
`reminders-view.tsx` deben seguir bajo deletion test antes de extraerse.

### `src/components`

Rol correcto: UI compartida y layout.

Contiene:

- componentes base en `ui`;
- layout/sidebar/navigation;
- feedback bubble.

Estado: bueno.

No esta mezclando persistencia ni Adapters. El feedback bubble delega flujo a
Feature/Server Action.

### `src/features`

Rol correcto: Modules de negocio y read Modules.

Inventario actual:

| Module | Archivos | Tests | Estado |
| --- | ---: | ---: | --- |
| access | 11 | 2 | Sano |
| appointments | 30 | 10 | Profundo y bien testeado |
| customers | 11 | 4 | Sano |
| dashboard | 4 | 1 | Read Module pequeno |
| employees | 19 | 6 | Profundo; privilegios aislados en data |
| feedback | 4 | 1 | Sano |
| notifications | 7 | 2 | Sano |
| platform | 33 | 13 | Profundo; privilegios aislados en data |
| reminders | 4 | 1 | Read Module manual |
| reports | 8 | 2 | Read Module con dominio propio |
| salon | 13 | 4 | Sano |
| services | 9 | 2 | Sano |

Estado general: fuerte.

Los Modules principales tienen Depth real: encapsulan validacion, reglas,
mapping, errores y Adapters. `appointments`, `platform` y `employees` son los
Modules con mayor complejidad, que es coherente con el dominio.

### `src/lib`

Rol correcto: infraestructura transversal.

Contiene:

- `auth/session`;
- `auth/permissions`;
- Supabase clients server/client/admin/auth-admin;
- observability;
- Result;
- utils de fecha, phone, classnames;
- validaciones compartidas.

Estado: bueno.

`src/lib/observability` ya funciona como Seam para log drain futuro. No conviene
crear mas abstracciones globales hasta que aparezca presion real.

### `supabase/migrations`

Rol correcto: autoridad de datos.

Contiene 30 migraciones ordenadas, incluyendo:

- schema inicial;
- RLS;
- RPC `create_appointment`;
- RBAC;
- platform admin;
- invitations;
- feedback reports;
- salon theme;
- delete salon RPC;
- constraints multi-tenant;
- platform overviews;
- audit log;
- optimizacion RLS.
- RPC `update_appointment` para editar/reprogramar citas.

Estado: bueno.

El modelo multi-tenant esta protegido por una mezcla razonable de:

- RLS;
- RPCs;
- constraints;
- triggers;
- tests RPC/RLS;
- E2E de aislamiento.

### `scripts`

Rol correcto: gates operativos.

Estado: fuerte.

Hay scripts para:

- arquitectura;
- health;
- staging;
- baseline;
- aislamiento;
- dataset;
- performance;
- observability;
- capacity;
- restore;
- security;
- support;
- reminders;
- release readiness;
- seed/cleanup.

El hallazgo operativo de Preview vino precisamente de un gate:
`release:scale-readiness`. Despues del redeploy de Preview, el gate volvio a
pasar con 42 OK / 0 bloqueos.

### `e2e`

Rol correcto: pruebas de flujos criticos.

Contiene:

- auth;
- feature-disabled;
- multi-tenant-isolation;
- platform-admin;
- salon-owner.

Estado: bueno. Debe ejecutarse solo contra Preview/Staging verificado, no contra
produccion.

### `docs` y `docs/adr`

Rol correcto: decisiones y runbooks.

Estado: bueno con historial abundante.

La documentacion vigente esta marcada en `docs/README.md`. Hay historial de
auditorias/fases anteriores, pero no se considera bloqueo porque el indice
separa documentos vigentes, base anterior e historicos.

Los ADRs importantes siguen vigentes:

- 0001 RLS multi-tenant.
- 0002 appointment_items como fuente de verdad.
- 0008 tests como red de seguridad.
- 0009 monolito modular feature-first.
- 0010 excepciones server-only/admin Adapter.

## Comparacion Contra Auditorias Y Fases Previas

Hallazgos previos resueltos o estabilizados:

- Monolito modular consolidado.
- `src/app` ya no contiene reglas de negocio pesadas que deban vivir en
  Adapters.
- Reports y Reminders quedaron como read Modules.
- Platform, Employees y Appointments tienen use-cases y tests fuertes.
- Privilegios Supabase Admin/Auth Admin estan localizados.
- Gates de escala y produccion existen.
- Produccion esta conectada al Supabase production correcto.

Hallazgo nuevo/resuelto:

- Preview/Staging desplegado estaba usando Supabase production. Se corrigio con
  variables de Preview y redeploy; `staging:verify-env` y
  `release:scale-readiness` pasaron.

## Riesgos Reales

### Riesgo 1 - Preview/Staging apunta a production

Severidad: alta operativa si reaparece. Estado actual: corregido.

Impacto:

- Un E2E o seed contra un Preview mal configurado podria tocar datos reales.
- La confianza en staging depende de `staging:verify-env`.
- `release:scale-readiness` bloquea por diseno si el mismatch reaparece.

Accion de control recurrente:

1. En Vercel, revisar Environment Variables de Preview.
2. Asegurar que Preview tenga:
   - `NEXT_PUBLIC_SUPABASE_URL` de staging;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` de staging;
   - `SUPABASE_SERVICE_ROLE_KEY` de staging;
   - `GLOWBOOK_ENV=staging`;
   - `PRODUCTION_SUPABASE_URL` de production.
3. Hacer redeploy de Preview despues de cambios de variables.
4. Ejecutar siempre antes de E2E/seed:

```text
npm run staging:verify-env
npm run release:scale-readiness
npm run test:e2e:staging
```

### Riesgo 2 - Lanzamiento nacional amplio

Severidad: media/alta futura.

No hay bloqueo de arquitectura para crecimiento controlado, pero lanzamiento
amplio requiere:

- observability/log drain real;
- alertas;
- soporte formal;
- owner suplente;
- revision de capacidad/planes;
- rate limits/CSP/secrets confirmados operativamente.

### Riesgo 3 - UI route-local grande

Severidad: baja actual.

Mantener deletion test antes de extraer componentes o crear Seams nuevos.

## Que No Recomiendo Cambiar

- No borrar staging.
- No migrar a microservicios.
- No mover toda la UI route-local fuera de `src/app`.
- No crear capa global `services`.
- No crear repositorios genericos por tabla.
- No crear Interfaces abstractas para Adapters unicos.
- No prometer recordatorios automaticos sin Module de envio real.

## Cuanto Falta

Para arquitectura y orden interno:

```text
97% - 98% listo
2% - 3% restante
```

Para crecimiento controlado con clientes reales:

```text
95% - 98% listo
2% - 5% restante operativo
```

Lo restante es disciplina operativa: gates antes de releases, no probar contra
produccion y revisar logs/despliegues despues de cambios grandes.

Para lanzamiento nacional amplio:

```text
70% - 80% listo
20% - 30% restante operativo
```

No por mala arquitectura, sino por operacion: soporte, observability, planes,
alertas, limites y respuesta a incidentes.

## Proximo Paso Recomendado

Prioridad inmediata:

1. Mantener `npm run staging:verify-env` antes de E2E/seed.
2. Mantener `npm run release:scale-readiness` antes de releases importantes.
3. Continuar mejora funcional del producto para 5-10 salones.

Staging ya puede tratarse como entorno seguro mientras esos gates sigan pasando.

## Conclusion

El proyecto esta bien organizado como monolito modular. Las separaciones de
responsabilidad son claras, los Modules tienen buena Locality, Supabase queda
detras de Adapters auditables y los guardrails detectan problemas reales.

La auditoria no recomienda una reestructura grande. Recomienda mantener gates
antes de cada release, usar Preview/Staging para pruebas y reservar las mejoras
de observability/capacity/support para el momento en que se busque lanzamiento
nacional amplio.
