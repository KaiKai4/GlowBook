// Pantallas a auditar. `dialogs` son botones que abren un diálogo; `tabs` son pestañas
// que cambian el formulario de la pantalla. Los RegExp se comparan con el nombre accesible.
export interface AuditedScreen {
  path: string;
  dialogs?: RegExp[];
  tabs?: RegExp[];
}

export const OWNER_SCREENS: readonly AuditedScreen[] = [
  { path: "/" },
  { path: "/appointments" },
  { path: "/appointments/new" },
  { path: "/customers", dialogs: [/^Nuevo cliente$/] },
  { path: "/employees", dialogs: [/^Nuevo colaborador$/] },
  { path: "/services", dialogs: [/^Nuevo servicio$/] },
  { path: "/roles", dialogs: [/^Nuevo rol$/] },
  { path: "/expenses", tabs: [/^Nuevo gasto$/, /^Compra de inventario$/] },
  { path: "/inventory", tabs: [/^Nuevo producto$/, /^Transferir stock$/] },
  { path: "/retail" },
  { path: "/plantillas" },
  { path: "/recordatorios" },
  { path: "/reports" },
  { path: "/salon" },
  { path: "/salon/actividad" },
];

// Formularios de plataforma en línea (sin diálogo): se auditan con el formulario abierto.
export const PLATFORM_SCREENS: readonly AuditedScreen[] = [
  { path: "/admin" },
  { path: "/admin/salons" },
  { path: "/admin/plans" },
  { path: "/admin/plans?new=1" },
  { path: "/admin/invitations" },
  { path: "/admin/subscriptions" },
  { path: "/admin/reports" },
  { path: "/admin/audit" },
];

// Pantallas que visita un colaborador con permisos limitados (pueden redirigir o mostrar acceso denegado).
export const LIMITED_SCREENS: readonly string[] = [
  "/",
  "/appointments",
  "/appointments/new",
  "/customers",
  "/employees",
  "/reports",
  "/roles",
  "/salon",
  "/services",
];
