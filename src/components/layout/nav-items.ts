import type { Permission } from "@/features/access/domain/permission-checks";
import type { SalonFeatureKey } from "@/features/salon-features";
import { normalizeDisabledSalonFeatures } from "@/features/salon-features";

/**
 * Nombre del icono de cada ítem. Es un texto (no un componente) para que la lista
 * de grupos sea serializable y el servidor pueda pasarla al sidebar cliente.
 * El mapa nombre -> icono vive en `sidebar-nav.tsx`.
 */
export type NavIconName =
  | "dashboard"
  | "calendar"
  | "bell"
  | "users"
  | "user-cog"
  | "scissors"
  | "shopping-bag"
  | "package"
  | "bar-chart"
  | "receipt"
  | "shield"
  | "message"
  | "settings";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
  permissions?: Permission[];
  feature?: SalonFeatureKey;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * Lo que decide qué módulos ve una persona. Se calcula en el servidor (layout),
 * no en el cliente, así el sidebar solo pinta la lista que recibe.
 */
export interface VisibilityContext {
  permissions: readonly Permission[];
  isOwner: boolean;
  disabledFeatures?: readonly string[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Inicio", href: "/", icon: "dashboard" },
    ],
  },
  {
    label: "Agenda",
    items: [
      { label: "Citas", href: "/appointments", icon: "calendar", permissions: ["appointments.view", "appointments.manage"], feature: "appointments" },
      { label: "Recordatorios", href: "/recordatorios", icon: "bell", permissions: ["reminders.send"], feature: "recordatorios" },
    ],
  },
  {
    label: "Gestión",
    items: [
      { label: "Clientes", href: "/customers", icon: "users", permissions: ["customers.manage"], feature: "customers" },
      { label: "Colaboradores", href: "/employees", icon: "user-cog", permissions: ["employees.manage"], feature: "employees" },
      { label: "Servicios", href: "/services", icon: "scissors", permissions: ["services.manage"], feature: "services" },
      { label: "Vitrina", href: "/retail", icon: "shopping-bag", permissions: ["retail.manage"], feature: "retail" },
      { label: "Inventario", href: "/inventory", icon: "package", permissions: ["inventory.manage"], feature: "inventory" },
    ],
  },
  {
    label: "Administración",
    items: [
      { label: "Reportes", href: "/reports", icon: "bar-chart", permissions: ["reports.view"], feature: "reports" },
      { label: "Gastos", href: "/expenses", icon: "receipt", permissions: ["expenses.manage"], feature: "expenses" },
      { label: "Roles", href: "/roles", icon: "shield", permissions: ["roles.manage"], feature: "roles" },
      { label: "Plantillas", href: "/plantillas", icon: "message", permissions: ["reminders.send"], feature: "plantillas" },
      { label: "Salón", href: "/salon", icon: "settings", permissions: ["salon.manage"], feature: "salon" },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

function canSee(item: NavItem, context: VisibilityContext): boolean {
  const disabled = normalizeDisabledSalonFeatures(context.disabledFeatures ?? []);
  if (item.feature && disabled.includes(item.feature)) return false;

  return (
    !item.permissions ||
    context.isOwner ||
    item.permissions.some((permission) => context.permissions.includes(permission))
  );
}

export function getVisibleNavItems(context: VisibilityContext): NavItem[] {
  return NAV_ITEMS.filter((item) => canSee(item, context));
}

export function getVisibleNavGroups(context: VisibilityContext): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(item, context)),
  })).filter((group) => group.items.length > 0);
}
