# ADR 0028: Inyección de dependencias en comandos con lógica

- **Estado**: Aceptada. Sustituye a [ADR 0025](0025-cuando-inyectar-dependencias.md). Modifica las reglas de capas de [ADR 0019](0019-arquitectura-por-capas-verificada.md) (ver "Cambios de reglas de capas").
- **Fecha**: 2026-10-10

## Contexto

ADR 0025 limitó la inyección de dependencias a los comandos de transición de estado de citas (`cancelAppointment`, `confirmAppointment`, `completeAppointment`). El resto de casos de uso importaba sus repositorios directamente y se probaba con `vi.mock` sobre `data/`.

En la práctica, esa frontera dejó sin control a casos de uso que escriben en base de datos (RPC, `insert`, `update`, `delete`) o que tienen ramificación de negocio (por ejemplo, empleados, planes comerciales, clientes duplicados, ventas de retail o movimientos de inventario). Sus tests dependen de la ruta de importación de `data/`, y un `vi.mock` que devuelve cualquier forma no comprueba que coincida con la firma real del repositorio. Además, la regla de "solo `vi.mock` para lecturas" no distinguía bien entre una consulta pura de lectura y un comando que escribe.

Las reglas de capas también cambiaron en la fase 2 del plan de arquitectura. Esos cambios se documentan aquí porque modifican lo decidido en ADR 0019.

## Decisión

1. **Regla de inyección.** Todo caso de uso que **escribe** (RPC, `insert`, `update`, `delete`) o que tiene **ramificación de negocio** recibe sus colaboradores como `deps` tipadas con valor por defecto. El patrón es el de `CompleteAppointmentDeps` en `src/features/appointments/use-cases/complete-appointment.ts`:
   - `export interface XDeps { ...funciones... }` declara la interfaz de colaboradores.
   - `const defaultXDeps: XDeps = { ...funciones reales de data/ u otros módulos... }` enlaza las funciones de producción.
   - La función exportada recibe `deps: XDeps = defaultXDeps` como **último** parámetro opcional. Los llamadores de producción no cambian.
2. **Consultas puras de lectura.** Un caso de uso que solo lee sigue importando sus repositorios directamente y sus tests usan `vi.mock` sobre `data/`. No se añade un parámetro `deps` solo para poder mockear.
3. **Tests de los casos de uso migrados.** Los tests pasan de `vi.mock` de `data/` a fakes tipados: objetos que cumplen `XDeps`, con `vi.fn` tipado cuando hace falta. El `vi.mock` de infraestructura transversal (por ejemplo `@/infra/observability`) puede quedarse. Ninguna aserción ni caso se pierde.
4. **Pasos extraídos.** Un caso de uso que se divide por responsabilidad (SRP) puede extraer pasos como funciones con sus propias `deps`, siempre dentro del mismo módulo y sin exportarlas si nadie las usa fuera.
5. **Prohibido: contenedores de inyección y service locators.** Se mantiene lo decidido en ADR 0025, punto 4. La inyección es un parámetro opcional con valor por defecto, y nada más.
6. **Exportaciones.** `defaultXDeps` no se exporta si nadie lo usa fuera del archivo. La interfaz `XDeps` se exporta solo si un test la importa. Knip cuenta los tests como consumidores.

Esta regla sustituye al punto 2 y al punto 3 de ADR 0025. Los puntos 1 y 4 se mantienen.

### Ámbito de la fase

La regla se aplica a los casos de uso de: `employees`, `billing`, `platform`, `customers`, `inventory`, `retail`, `expenses`, `reminders` (registro manual de recordatorios), `appointments` (crear, actualizar y preparar items) y `access` (borrado de roles y comandos de roles).

## Cambios de reglas de capas (fase 2)

Las siguientes reglas de `.dependency-cruiser.cjs` se cambiaron en la fase 2. Modifican lo decidido en [ADR 0019](0019-arquitectura-por-capas-verificada.md), en su tabla de capas y en su sección de controles:

- **`domain-pure`**: el dominio (`src/features/*/domain`) ya no depende de `src/infra` en general. Solo se permiten las piezas puras de infraestructura: `src/infra/format/`, `src/infra/public-error.ts` y `src/infra/result.ts`. Antes el dominio podía importar cualquier cosa de `src/infra` que no fuera Supabase. La lista blanca hace que cualquier nueva importación de infraestructura en el dominio falle el control.
- **`use-cases-no-db`** (nueva): los casos de uso no importan el cliente Supabase (`src/infra/supabase/`) ni `@supabase/*`. El acceso a datos pasa siempre por `data/`. ADR 0019 permitía a los casos de uso depender de `src/infra` sin distinguir el cliente de Supabase.
- **`app-via-feature-index`**: `src/components` sigue las mismas reglas que `src/app`. Antes solo se aplicaban a `src/app`. Los imports de `src/components` hacia un módulo pasan por su `index.ts`, `schemas.ts` o `domain/`.
- **`app-via-feature-index-no-type-exemption`** (nueva): los imports de `use-cases/` y `data/` desde `src/app` y `src/components` quedan prohibidos **incluso si son solo de tipo**. ADR 0019 permitía los imports de tipo. Los tipos que necesita la presentación se exportan por el `index.ts` del módulo.

Estos cambios hacen la regla más estricta. Ninguna excepción nueva se añadió a una lista. El control sigue siendo por patrón de ruta, sin baseline.

### Prueba de platform admin: `PlatformAdminProof`

El cliente `service_role` de billing (`billingDb()`, ADR 0010) no debe poder usarse desde una función de plataforma sin la guarda de platform admin. La guarda se hace por tipos:

- `src/infra/auth/platform-admin-proof.ts` declara una clase no exportada como valor, con un campo privado de marca y `userId` de solo lectura. Exporta solo el tipo `PlatformAdminProof` y `issuePlatformAdminProof(userId)`. Un objeto literal con la misma forma no es asignable.
- `requirePlatformAdminProof()` en `src/app/_composition/request-context.ts` es el único emisor en producción. Verifica la sesión y `platform_admins` y devuelve la prueba. `requirePlatformAdmin()` sigue existiendo y devuelve solo el `userId`.
- Los repos de plataforma de billing reciben `proof: PlatformAdminProof` como primer parámetro y obtienen el cliente con `platformDb(proof)`. Los casos de uso de plataforma (`billing/use-cases`, `getPlatformInvitations`) la propagan. Las acciones (`definePlatformAction`) la obtienen del composition root y la pasan en la sesión (`session.proof`).
- Regla de dependency-cruiser `platform-admin-proof-issuer`: fuera de `src/app/_composition` y `src/infra/auth`, el archivo solo puede importarse como tipo (`dependencyTypesNot: ["type-only"]`). El control `src/infra/architecture-boundaries.test.ts` la ejecuta contra el grafo.
- Regla de dependency-cruiser `billing-db-importers`: `billing-db.ts` (donde está `billingDb()`, service_role) solo lo importan los repos de billing (`data/*.repo.ts`). Ningún caso de uso ni otro módulo puede obtener el cliente crudo. La prueba `src/infra/architecture-boundaries.test.ts` la verifica contra el grafo.
- Excepción documentada: la alta por invitación (`accept-invitation`, ADR 0005) no tiene sesión de admin. Usa `findPlanWithChildrenAtAcceptance` y `assignSalonPlanAtAcceptance`, que usan `billingDb()` sin prueba. El token y el email ya se validaron en la RPC `accept_invitation`. Son las únicas funciones sin prueba que usan `billingDb()` y están listadas en `billing-db.ts`. La regla `billing-db-importers` limita dónde puede usarse esa excepción: solo dentro de los repos de billing, nunca desde un caso de uso.

Límite: la prueba garantiza que el llamador pasó por el composition root en tiempo de compilación, no que la sesión siga vigente. La verificación de sesión ocurre en `requirePlatformAdminProof`, en cada petición (la memoización es solo por petición con `react cache`). `platformDb` además rechaza una prueba sin `userId`.

## Consecuencias

Beneficios:

- Los comandos que escriben o ramifican se prueban con fakes tipados. Si cambia la firma de un repositorio, TypeScript marca el fake y el fallo aparece en compilación.
- Los tests de comandos no dependen de la ruta de importación de `data/`, así que mover un repositorio no rompe `vi.mock`.
- La presentación no puede importar tipos de `use-cases/` ni `data/` directamente. Los tipos se exportan por el índice público.

Costes y cuidados:

- Añadir una dependencia nueva a un comando obliga a actualizar su interfaz `Deps`, su `defaultXDeps` y su fake. Es un coste deliberado.
- Los casos de uso de lectura siguen siendo más simples y sus tests siguen dependiendo de `vi.mock`. Hay que mantener esos `vi.mock` al mover archivos.
- Cualquier revisión que proponga un contenedor de DI o un localizador de servicios debe rechazarse por ADR 0025 (punto 4), que se mantiene.
- Las reglas de capas nuevas pueden obligar a exportar tipos por el `index.ts` del módulo. Es el comportamiento esperado, no un fallo.

## Relación con otros ADR

- **[ADR 0025](0025-cuando-inyectar-dependencias.md)**: sustituido por este ADR en la regla de ámbito (puntos 2 y 3) y en la lista de comandos. Se mantiene la prohibición de contenedores de DI.
- **[ADR 0019](0019-arquitectura-por-capas-verificada.md)**: modificado en las reglas de dominio, use-cases, presentación y tipos de `data/` descritas en "Cambios de reglas de capas (fase 2)". El resto de ADR 0019 sigue vigente.
