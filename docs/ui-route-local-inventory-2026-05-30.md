# Inventario De UI Route-Local

Fecha: 2026-05-30

Fuente: Fase 22 de `docs/architecture-audit-phases-2026-05-30.md`.

## Verificacion

Busqueda ejecutada:

```text
rg "@/lib/supabase|features/.*/data|createSupabase" src/app -n
```

Resultado relevante:

- `src/app` no importa `features/*/data`.
- Los usos directos de Supabase en `src/app` estan limitados a:
  - `src/app/(auth)/login/page.tsx`
  - `src/app/(auth)/join/[token]/join-form.tsx`
  - `src/app/(auth)/invite/[token]/page.tsx`
  - `src/app/api/auth/signout/route.ts`

Estos usos pertenecen a delivery/auth y no a reglas de negocio del Salon.

## Componentes Route-Local Revisados

Archivos grandes o sensibles bajo `src/app/(dashboard)`:

- `salon/salon-settings.tsx`
- `appointments/appointments-calendar.tsx`
- `services/services-manager.tsx`
- `recordatorios/reminders-view.tsx`
- `appointments/appointments-day-view.tsx`
- `reports/reports-view.tsx`
- `appointments/new/appointment-services-step.tsx`
- `roles/roles-manager.tsx`
- `appointments/new/appointment-wizard.tsx`
- `appointments/dialogs/*`
- `employees/*`
- `customers/*`
- `plantillas/templates-manager.tsx`

## Clasificacion

Se quedan en `src/app` por ahora:

- pantallas y formularios que solo renderizan view models;
- flujos client-side especificos de una ruta;
- componentes que no se reutilizan fuera de su ruta;
- componentes que no importan data Adapters.

Vigilar en cambios futuros:

- wizard de citas si agrega reglas nuevas de disponibilidad o scheduling;
- managers de servicios, roles y plantillas si empiezan a duplicar validaciones
  de schemas o reglas de use-cases;
- reportes si empieza a calcular metricas en la vista;
- recordatorios si pasa de vista operativa a envio real.

## Criterio De Extraccion

Mover fuera de `src/app` solo si aparece una de estas senales:

- el componente contiene reglas de dominio;
- el componente conoce query shape o data Adapters;
- el componente se reutiliza entre rutas;
- el componente tiene mapeos complejos que pertenecen a un view model;
- la prueba util debe cruzar una Interface de feature, no markup local.

Destino recomendado:

- UI reutilizable de feature: `src/features/<feature>/components`.
- regla pura: `src/features/<feature>/domain`.
- mapeo de datos: `src/features/<feature>/use-cases` o `view-models.ts`.

## Decision

No se mueve UI en esta fase. El arbol actual no muestra una fuga clara de
negocio hacia `src/app`. Mover por tamano reduciria Locality y crearia Seams
cosmeticos.

## Revision 2026-05-31

Fuente: Fase 43 de `docs/architecture-audit-phases-2026-05-31.md`.

Hotspots revisados:

| Archivo | Lineas | Resultado |
|---|---:|---|
| `src/app/(dashboard)/salon/salon-settings.tsx` | 370 | UI route-local; consume Server Actions locales; sin Supabase ni data Adapters. |
| `src/app/(dashboard)/appointments/appointments-calendar.tsx` | 317 | UI de calendario; consume `features/appointments/view-models`; sin persistencia directa. |
| `src/app/(dashboard)/services/services-manager.tsx` | 306 | UI de gestion de catalogo; consume acciones locales; sin query shape. |
| `src/app/(dashboard)/recordatorios/reminders-view.tsx` | 279 | UI de cola manual; consume view model y render de plantilla; sin envio real. |
| `src/app/(dashboard)/reports/reports-view.tsx` | 265 | UI de reportes; las metricas viven en `features/reports`. |

Busqueda ejecutada:

```text
rg '@/features/.*/data|@/lib/supabase|createSupabase' <hotspots>
```

Resultado: sin matches.

Decision:

No se extrae UI por tamano. Ningun hotspot muestra una Seam real que mejore
Depth o Locality ahora. Mantenerlos como UI route-local y revisar de nuevo solo
si aparece reuse, regla de dominio, query shape o necesidad de testear una
Interface de feature.
