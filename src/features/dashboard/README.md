# Dashboard Module

Responsabilidad: read Module para la vista de inicio del Salon.

Interface principal (`index.ts`):

- `use-cases/get-dashboard-overview.ts`
- `use-cases/get-onboarding-checklist.ts`
- `domain/dashboard-money.ts` (puro)
- `data/dashboard.repo.ts`

Dominio con claves, no con textos: los textos, descripciones y rutas del checklist
viven en `src/app/(dashboard)/onboarding-checklist-presentation.ts`.

Autoridad final:

- Este Module compone datos para vista, no posee reglas profundas de citas,
  clientes o servicios.
- Si una metrica se vuelve reutilizable o compleja, debe moverse a un domain
  Module con tests.

Adapters externos:

- `data/dashboard.repo.ts` concentra query shape para la vista.

Tests que protegen el Module:

- `use-cases/get-dashboard-overview.test.ts`

No debe vivir aqui:

- reglas de disponibilidad.
- lifecycle de citas.
- logica de clientes o colaboradores.
- queries que no alimentan el dashboard.
