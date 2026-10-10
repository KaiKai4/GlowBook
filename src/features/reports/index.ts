import "server-only";
// Interfaz pública del módulo de reportes. Servidor y tipos; los componentes cliente que
// necesitan solo dominio (gráficos, periodos) importan de `domain/` directamente.
// Pendiente: `src/app/api/reports/export` aún importa `use-cases/get-report-export` directamente.
export { getOperationalReport, type OperationalReportViewModel } from "./use-cases/get-operational-report";
export { parseReportFilters, type ReportQueryInput } from "./schemas";

export { getReportExportData, type ReportExportScope } from "./use-cases/get-report-export";
