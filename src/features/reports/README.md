# Reports Module

Responsabilidad: reportes operativos del Salon.

Interface principal:

- `schemas.ts`
- `use-cases/get-operational-report.ts`
- `domain/period.ts`
- `domain/metrics.ts` (tipos del view model)
- `domain/analytics.ts`
- `data/reports.repo.ts`

Autoridad final:

- SQL entrega agregados aislados por Salon (`report_*`, migracion 066). El
  periodo operativo (totales, desgloses y comisiones) se calcula en la base
  sobre el rango completo; el cliente ya no descarga filas crudas.
- `domain/metrics.ts` solo define los tipos del view model; no calcula.
- `appointment_items` es la fuente de verdad para desgloses por colaborador y
  servicio (agregados en `report_operational_breakdown` y `report_commissions`).

Cambio de conducta (Fase 5):

- Antes, el periodo se sumaba en JS sobre filas crudas traidas por PostgREST,
  que tope en 1000 filas: con mas de 1000 citas o items en el periodo, las
  cifras (ingresos, desgloses, comisiones) se truncaban en silencio.
- Ahora las cifras del periodo son completas sin importar el volumen. Las
  definiciones son las mismas que el calculo JS anterior (ver el oraculo en
  `use-cases/get-operational-report.parity.test.ts`).
- El filtro mensual recalcula solo `OperationalReportPeriodViewModel`.
- Las graficas consumen `HistoricalReportAnalytics`, una ventana fija de 12
  meses que no se vuelve a solicitar al cambiar el mes de las tarjetas.
- Gastos operativos e inventario son fuentes distintas: las reposiciones no se
  suman dentro de gastos manuales para evitar egresos duplicados.

Adapters externos:

- `data/reports.repo.ts` para identidad del salon y el historial mensual.
- `data/rpc/reports-read-models.rpc.ts` para los agregados SQL del periodo.

Tests que protegen el Module:

- `use-cases/get-operational-report.parity.test.ts`
- `domain/period.test.ts`

No debe vivir aqui:

- queries de plataforma cross-tenant.
- reglas de disponibilidad de citas.
- componentes de pantalla de reportes.

Nota de ownership:

Si las metricas crecen, separar por familias reales: revenue, asistencia,
empleados, servicios y capacidad. No crear archivos por estetica.
