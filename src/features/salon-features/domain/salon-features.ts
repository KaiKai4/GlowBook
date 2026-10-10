// Fuente unica de los modulos contratables del salon. Cada modulo declara los
// permisos que afecta; el mapa permiso -> modulos de features access se deriva de aqui.
// Este modulo no importa access (evita ciclos): los permisos son cadenas.
interface SalonFeatureDef {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly permissions: readonly string[];
}

export const SALON_FEATURES = [
  {
    key: "appointments",
    label: "Citas",
    description: "Agenda y creacion de citas.",
    permissions: ["appointments.view", "appointments.manage", "appointments.view_all"],
  },
  {
    key: "recordatorios",
    label: "Recordatorios",
    description: "Envio de recordatorios por WhatsApp.",
    permissions: ["reminders.send"],
  },
  {
    key: "customers",
    label: "Clientes",
    description: "Gestión de clientes.",
    permissions: ["customers.manage"],
  },
  {
    key: "employees",
    label: "Colaboradores",
    description: "Equipo, horarios y accesos.",
    permissions: ["employees.manage"],
  },
  {
    key: "services",
    label: "Servicios",
    description: "Catalogo de servicios.",
    permissions: ["services.manage"],
  },
  {
    key: "inventory",
    label: "Inventario",
    description: "Productos, stock y reposiciones.",
    permissions: ["inventory.manage"],
  },
  {
    key: "retail",
    label: "Vitrina",
    description: "Ventas de productos del salon.",
    permissions: ["retail.manage"],
  },
  {
    key: "expenses",
    label: "Gastos",
    description: "Registro de egresos operativos.",
    permissions: ["expenses.manage"],
  },
  {
    key: "reports",
    label: "Reportes",
    description: "Metricas e informes operativos.",
    permissions: ["reports.view"],
  },
  {
    key: "roles",
    label: "Roles",
    description: "Roles y permisos del salon.",
    permissions: ["roles.manage"],
  },
  {
    key: "plantillas",
    label: "Plantillas",
    description: "Plantillas de mensajes.",
    permissions: ["reminders.send"],
  },
  {
    key: "salon",
    label: "Salon",
    description: "Configuración del negocio.",
    permissions: ["salon.manage"],
  },
] as const satisfies readonly SalonFeatureDef[];

export type SalonFeatureKey = (typeof SALON_FEATURES)[number]["key"];

const SALON_FEATURE_KEYS = new Set<string>(
  SALON_FEATURES.map((feature) => feature.key)
);

function isSalonFeatureKey(value: string): value is SalonFeatureKey {
  return SALON_FEATURE_KEYS.has(value);
}

/** Modulos (en orden de catalogo) que declaran el permiso indicado. */
export function salonFeaturesForPermission(permission: string): SalonFeatureKey[] {
  return SALON_FEATURES.filter((feature) =>
    declaresPermission(feature, permission)
  ).map((feature) => feature.key);
}

function declaresPermission(
  feature: { readonly permissions: readonly string[] },
  permission: string
): boolean {
  return feature.permissions.includes(permission);
}

export function normalizeDisabledSalonFeatures(
  features: readonly string[] | null | undefined
): SalonFeatureKey[] {
  return Array.from(
    new Set((features ?? []).filter(isSalonFeatureKey))
  );
}

export function isSalonFeatureDisabled(
  disabledFeatures: readonly string[] | null | undefined,
  feature: SalonFeatureKey
): boolean {
  return normalizeDisabledSalonFeatures(disabledFeatures).includes(feature);
}
