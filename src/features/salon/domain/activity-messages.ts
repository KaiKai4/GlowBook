// Texto visible del log de actividad, derivado de (accion, tabla). La fila de
// actividad guarda datos estructurados; el texto se decide aqui, en un unico
// punto, y cualquier valor desconocido recibe un texto generico.

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

const ACTION_VERBS: Record<"insert" | "update" | "delete", string> = {
  insert: "Creo",
  update: "Actualizo",
  delete: "Elimino",
};

const UNKNOWN_ACTIVITY_TEXT = "Registro de actividad";

export function describeSalonActivity(action: string, tableName: string): string {
  if (tableName === "salons" && action === "update") return "Actualizo la configuración del salon";
  if (!isActivityAction(action)) return UNKNOWN_ACTIVITY_TEXT;

  const subject = Object.hasOwn(TABLE_LABELS, tableName)
    ? TABLE_LABELS[tableName]
    : `un registro de ${tableName}`;
  return `${ACTION_VERBS[action]} ${subject}`;
}

function isActivityAction(value: string): value is keyof typeof ACTION_VERBS {
  return Object.hasOwn(ACTION_VERBS, value);
}
