// Tipos compartidos de los scripts de seed de staging. Solo declaraciones de tipos (sin runtime).

/** Fila devuelta por Supabase al insertar: id obligatorio y columnas arbitrarias. */
export type DbRow = { id: string; [column: string]: unknown };

/** Fila de permiso del catálogo global (id y clave). */
export type PermissionRow = { id: string; key: string };

/** Fila de servicio insertada en la semilla. */
export type ServiceRow = DbRow & { category_id: string; name: string; duration_minutes: number; price: number };

/** Fila de producto insertada en la semilla. */
export type ProductRow = DbRow & { cost_price: number; sale_price: number };

/** Resumen de la semilla de benchmark: filas y JSON por tabla y cohorte. */
export type SeedSummary = {
  batchId: string;
  password: string;
  totalRows: number;
  accounts: { cohort: string; salon: string; email: string }[];
  cohorts: Record<string, { label: string; salons: number; authUsers: number; tables: Record<string, { rows: number; jsonBytes: number }> }>;
};
