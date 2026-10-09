import type { ComponentType } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserCog,
  Scissors,
  BarChart3,
  Settings,
  Shield,
  Bell,
  MessageSquareText,
  Package,
  ShoppingBag,
  ReceiptText,
} from "lucide-react";
import type { Permission } from "@/features/access";
import type { SalonFeatureKey } from "@/features/salon-features";
import { normalizeDisabledSalonFeatures } from "@/features/salon-features";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permissions?: Permission[];
  feature?: SalonFeatureKey;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Inicio", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Agenda",
    items: [
      { label: "Citas", href: "/appointments", icon: CalendarDays, permissions: ["appointments.view", "appointments.manage"], feature: "appointments" },
      { label: "Recordatorios", href: "/recordatorios", icon: Bell, permissions: ["reminders.send"], feature: "recordatorios" },
    ],
  },
  {
    label: "Gestión",
    items: [
      { label: "Clientes", href: "/customers", icon: Users, permissions: ["customers.manage"], feature: "customers" },
      { label: "Colaboradores", href: "/employees", icon: UserCog, permissions: ["employees.manage"], feature: "employees" },
      { label: "Servicios", href: "/services", icon: Scissors, permissions: ["services.manage"], feature: "services" },
      { label: "Vitrina", href: "/retail", icon: ShoppingBag, permissions: ["retail.manage"], feature: "retail" },
      { label: "Inventario", href: "/inventory", icon: Package, permissions: ["inventory.manage"], feature: "inventory" },
    ],
  },
  {
    label: "Administración",
    items: [
      { label: "Reportes", href: "/reports", icon: BarChart3, permissions: ["reports.view"], feature: "reports" },
      { label: "Gastos", href: "/expenses", icon: ReceiptText, permissions: ["expenses.manage"], feature: "expenses" },
      { label: "Roles", href: "/roles", icon: Shield, permissions: ["roles.manage"], feature: "roles" },
      { label: "Plantillas", href: "/plantillas", icon: MessageSquareText, permissions: ["reminders.send"], feature: "plantillas" },
      { label: "Salon", href: "/salon", icon: Settings, permissions: ["salon.manage"], feature: "salon" },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

function canSee(
  item: NavItem,
  userPermissions: Permission[],
  isOwner: boolean,
  disabledFeatures: readonly string[] = []
): boolean {
  const disabled = normalizeDisabledSalonFeatures(disabledFeatures);
  if (item.feature && disabled.includes(item.feature)) return false;

  return (
    !item.permissions ||
    isOwner ||
    item.permissions.some((permission) => userPermissions.includes(permission))
  );
}

export function getVisibleNavItems(
  userPermissions: Permission[],
  isOwner: boolean,
  disabledFeatures: readonly string[] = []
): NavItem[] {
  return NAV_ITEMS.filter((item) => canSee(item, userPermissions, isOwner, disabledFeatures));
}

export function getVisibleNavGroups(
  userPermissions: Permission[],
  isOwner: boolean,
  disabledFeatures: readonly string[] = []
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(item, userPermissions, isOwner, disabledFeatures)),
  })).filter((group) => group.items.length > 0);
}
