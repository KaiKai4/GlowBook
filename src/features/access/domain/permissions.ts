// Mirrors the DB permission catalog. Kept in sync with the migration seed.
export const PERMISSION_CATALOG = [
  { key: "salon.manage", description: "Editar datos del salon y ajustes" },
  { key: "roles.manage", description: "Crear roles y asignar permisos" },
  { key: "employees.manage", description: "Gestionar colaboradores" },
  { key: "services.manage", description: "Gestionar categorías y servicios" },
  { key: "inventory.manage", description: "Gestionar inventario y movimientos de stock" },
  { key: "retail.manage", description: "Registrar ventas de vitrina" },
  { key: "expenses.manage", description: "Registrar gastos del salon" },
  { key: "customers.manage", description: "Gestionar clientes" },
  { key: "appointments.view", description: "Ver el calendario y citas propias" },
  { key: "appointments.manage", description: "Crear, editar y cancelar citas" },
  { key: "appointments.view_all", description: "Ver todas las citas del salon" },
  { key: "reports.view", description: "Ver dashboard y reportes" },
  { key: "reminders.send", description: "Enviar recordatorios" },
] as const;
