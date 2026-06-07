# Reports Module

Responsabilidad: reportes operativos del Salon.

Interface principal:

- `schemas.ts`
- `use-cases/get-operational-report.ts`
- `domain/period.ts`
- `domain/metrics.ts`
- `domain/analytics.ts`
- `data/reports.repo.ts`

Autoridad final:

- SQL entrega rows aisladas por Salon.
- `domain/metrics.ts` calcula metricas puras.
- `appointment_items` es la fuente de verdad para desgloses por colaborador y
  servicio.
- El filtro mensual recalcula solo `OperationalReportPeriodViewModel`.
- Las graficas consumen `HistoricalReportAnalytics`, una ventana fija de 12
  meses que no se vuelve a solicitar al cambiar el mes de las tarjetas.
- Gastos operativos e inventario son fuentes distintas: las reposiciones no se
  suman dentro de gastos manuales para evitar egresos duplicados.

Adapters externos:

- `data/reports.repo.ts` para lecturas de citas, clientes e items.

Tests que protegen el Module:

- `domain/metrics.test.ts`
- `domain/period.test.ts`

No debe vivir aqui:

- queries de plataforma cross-tenant.
- reglas de disponibilidad de citas.
- componentes de pantalla de reportes.

Nota de ownership:

Si las metricas crecen, separar por familias reales: revenue, asistencia,
empleados, servicios y capacidad. No crear archivos por estetica.
