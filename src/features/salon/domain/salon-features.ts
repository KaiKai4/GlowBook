export const SALON_FEATURES = [
  {
    key: "appointments",
    label: "Citas",
    description: "Agenda y creacion de citas.",
  },
  {
    key: "recordatorios",
    label: "Recordatorios",
    description: "Envio de recordatorios por WhatsApp.",
  },
  {
    key: "customers",
    label: "Clientes",
    description: "Gestion de clientes.",
  },
  {
    key: "employees",
    label: "Colaboradores",
    description: "Equipo, horarios y accesos.",
  },
  {
    key: "services",
    label: "Servicios",
    description: "Catalogo de servicios.",
  },
  {
    key: "inventory",
    label: "Inventario",
    description: "Productos, stock y reposiciones.",
  },
  {
    key: "retail",
    label: "Vitrina",
    description: "Ventas de productos del salon.",
  },
  {
    key: "expenses",
    label: "Gastos",
    description: "Registro de egresos operativos.",
  },
  {
    key: "reports",
    label: "Reportes",
    description: "Metricas e informes operativos.",
  },
  {
    key: "roles",
    label: "Roles",
    description: "Roles y permisos del salon.",
  },
  {
    key: "plantillas",
    label: "Plantillas",
    description: "Plantillas de mensajes.",
  },
  {
    key: "salon",
    label: "Salon",
    description: "Configuracion del negocio.",
  },
] as const;

export type SalonFeatureKey = (typeof SALON_FEATURES)[number]["key"];

const SALON_FEATURE_KEYS = new Set<string>(
  SALON_FEATURES.map((feature) => feature.key)
);

export function isSalonFeatureKey(value: string): value is SalonFeatureKey {
  return SALON_FEATURE_KEYS.has(value);
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
