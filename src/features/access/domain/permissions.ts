// Mirrors the DB permission catalog. Kept in sync with the migration seed.
export const PERMISSION_CATALOG = [
  { key: "salon.manage",          description: "Editar datos del salón y ajustes" },
  { key: "roles.manage",          description: "Crear roles y asignar permisos" },
  { key: "employees.manage",      description: "Gestionar colaboradores" },
  { key: "services.manage",       description: "Gestionar categorías y servicios" },
  { key: "customers.manage",      description: "Gestionar clientes" },
  { key: "appointments.manage",   description: "Crear, editar y cancelar citas" },
  { key: "appointments.view_all", description: "Ver todas las citas del salón" },
  { key: "reports.view",          description: "Ver dashboard y reportes" },
  { key: "reminders.send",        description: "Enviar recordatorios" },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]["key"];
