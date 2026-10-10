# Reports Module

Responsabilidad: reportes operativos del Salon.

Interface principal:

- `schemas.ts`
- `use-cases/get-operational-report.ts`
- `domain/period.ts`
- `domain/metrics.ts` (tipos del view model)
- `domain/analytics.ts` (incluye `toLifetimeTotals`)
- `domain/period.ts` (incluye `lastDayOfMonth`)
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
  definiciones son las mismas que el calculo JS anterior (comprobado contra la
  base local en `use-cases/get-operational-report.rpc.test.ts`).
- El filtro mensual recalcula solo `OperationalReportPeriodViewModel`.
- Las graficas consumen `HistoricalReportAnalytics`, una ventana fija de 12
  meses que no se vuelve a solicitar al cambiar el mes de las tarjetas.
- Gastos operativos e inventario son fuentes distintas: las reposiciones no se
  suman dentro de gastos manuales para evitar egresos duplicados.

Historial y exportacion (SQL, migracion 066):

- Serie mensual, horas ocupadas, gastos por concepto, productos vendidos y
  alertas de inventario salen de `report_monthly_series`, `report_busy_hours`,
  `report_expense_concepts`, `report_product_sales` y `report_inventory_alerts`.
  Los acumulados (anual e historico) salen de `report_period_totals`.
- El historico completo usa una ventana fija amplia (desde 1970-01 hasta el
  año siguiente al actual). La base rellena los meses vacios en cero y
  `trimMonthlyRows` recorta la serie al primer y ultimo mes con movimientos.
- Diferencias conocidas frente al calculo JS anterior: un mes con solo movimientos
  de importe cero se recorta; el top de productos de la exportacion agrupa por
  producto (id) y no por nombre; los gastos con concepto "Reposiciones de
  inventario" se suman en lugar de sobrescribirse; movimientos con fecha posterior
  al año siguiente al actual no entran en el historico completo.

Adapters externos:

- `data/reports.repo.ts` para la identidad y la zona horaria del salon.
- `data/rpc/reports-read-models.rpc.ts` para los agregados SQL del periodo y acumulados.
- `data/rpc/reports-history.rpc.ts` para la serie mensual, horas, gastos, productos y alertas.

Tests que protegen el Module:

- `use-cases/get-operational-report.rpc.test.ts` (base local real)
- `use-cases/reports-sql-parity.test.ts` (oraculo JS del historial y exportacion)
- `domain/period.test.ts`

No debe vivir aqui:

- queries de plataforma cross-tenant.
- reglas de disponibilidad de citas.
- componentes de pantalla de reportes.

Nota de ownership:

Si las metricas crecen, separar por familias reales: revenue, asistencia,
empleados, servicios y capacidad. No crear archivos por estetica.
