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
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permissions?: Permission[];
}

export interface NavGroup {
  // Section heading shown above the group. The first group has none (it sits
  // right under the brand).
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Inicio", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Agenda",
    items: [
      { label: "Citas", href: "/appointments", icon: CalendarDays, permissions: ["appointments.view", "appointments.manage"] },
      { label: "Recordatorios", href: "/recordatorios", icon: Bell, permissions: ["reminders.send"] },
    ],
  },
  {
    label: "Gestión",
    items: [
      { label: "Clientes", href: "/customers", icon: Users, permissions: ["customers.manage"] },
      { label: "Colaboradores", href: "/employees", icon: UserCog, permissions: ["employees.manage"] },
      { label: "Servicios", href: "/services", icon: Scissors, permissions: ["services.manage"] },
    ],
  },
  {
    label: "Administración",
    items: [
      { label: "Reportes", href: "/reports", icon: BarChart3, permissions: ["reports.view"] },
      { label: "Roles", href: "/roles", icon: Shield, permissions: ["roles.manage"] },
      { label: "Plantillas", href: "/plantillas", icon: MessageSquareText, permissions: ["reminders.send"] },
      { label: "Salón", href: "/salon", icon: Settings, permissions: ["salon.manage"] },
    ],
  },
];

// Flat list of every nav item (callers that only need the visible item count).
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

function canSee(item: NavItem, userPermissions: Permission[], isOwner: boolean): boolean {
  return (
    !item.permissions ||
    isOwner ||
    item.permissions.some((p) => userPermissions.includes(p))
  );
}

export function getVisibleNavItems(
  userPermissions: Permission[],
  isOwner: boolean
): NavItem[] {
  return NAV_ITEMS.filter((item) => canSee(item, userPermissions, isOwner));
}

// Groups with their visible items; empty groups are dropped so no orphan heading shows.
export function getVisibleNavGroups(
  userPermissions: Permission[],
  isOwner: boolean
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(item, userPermissions, isOwner)),
  })).filter((group) => group.items.length > 0);
}
