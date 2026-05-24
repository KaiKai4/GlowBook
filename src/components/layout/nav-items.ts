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
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permissions?: Permission[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "/", icon: LayoutDashboard },
  { label: "Citas", href: "/appointments", icon: CalendarDays, permissions: ["appointments.view", "appointments.manage"] },
  { label: "Recordatorios", href: "/recordatorios", icon: Bell, permissions: ["reminders.send"] },
  { label: "Clientes", href: "/customers", icon: Users, permissions: ["customers.manage"] },
  { label: "Empleados", href: "/employees", icon: UserCog, permissions: ["employees.manage"] },
  { label: "Servicios", href: "/services", icon: Scissors, permissions: ["services.manage"] },
  { label: "Reportes", href: "/reports", icon: BarChart3, permissions: ["reports.view"] },
  { label: "Roles", href: "/roles", icon: Shield, permissions: ["roles.manage"] },
  { label: "Salón", href: "/salon", icon: Settings, permissions: ["salon.manage"] },
];

export function getVisibleNavItems(
  userPermissions: Permission[],
  isOwner: boolean
): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      !item.permissions ||
      isOwner ||
      item.permissions.some((p) => userPermissions.includes(p))
  );
}
