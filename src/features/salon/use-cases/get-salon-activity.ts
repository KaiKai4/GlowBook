import "server-only";

import { findSalonActivity, type ActivityLogRow } from "../data/activity-log.repo";

const TABLE_LABELS: Record<string, string> = {
  appointments: "una cita",
  customers: "un cliente",
  services: "un servicio",
  employees: "un colaborador",
  expenses: "un gasto",
  retail_sales: "una venta de vitrina",
  inventory_products: "un producto de inventario",
  inventory_movements: "un movimiento de inventario",
  roles: "un rol",
  salons: "la configuración del salon",
};

const ACTION_VERBS: Record<ActivityLogRow["action"], string> = {
  insert: "Creo",
  update: "Actualizo",
  delete: "Elimino",
};

export interface SalonActivityEntry {
  id: string;
  actorEmail: string;
  actionLabel: string;
  recordLabel: string;
  dateLabel: string;
  timeLabel: string;
}

export interface SalonActivityViewModel {
  entries: SalonActivityEntry[];
}

export async function getSalonActivity(): Promise<SalonActivityViewModel> {
  const rows = await findSalonActivity();

  return {
    entries: rows.map((row) => {
      const createdAt = new Date(row.created_at);
      return {
        id: row.id,
        actorEmail: row.actor_email || "sistema",
        actionLabel: describeAction(row),
        recordLabel: row.record_label,
        dateLabel: formatDate(createdAt),
        timeLabel: formatTime(createdAt),
      };
    }),
  };
}

function describeAction(row: ActivityLogRow): string {
  const verb = ACTION_VERBS[row.action];
  if (row.table_name === "salons") return "Actualizo la configuración del salon";
  const subject = TABLE_LABELS[row.table_name] ?? `un registro de ${row.table_name}`;
  return `${verb} ${subject}`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("es-PA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
