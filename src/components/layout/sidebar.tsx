"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  CalendarDays,
  Users,
  UserCog,
  Scissors,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  Sparkles,
  Bell,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Citas", href: "/appointments", icon: CalendarDays, permission: "appointments.manage" },
  { label: "Recordatorios", href: "/recordatorios", icon: Bell, permission: "appointments.manage" },
  { label: "Clientes", href: "/customers", icon: Users, permission: "customers.manage" },
  { label: "Empleados", href: "/employees", icon: UserCog, permission: "employees.manage" },
  { label: "Servicios", href: "/services", icon: Scissors, permission: "services.manage" },
  { label: "Reportes", href: "/reports", icon: BarChart3, permission: "reports.view" },
  { label: "Equipo", href: "/team", icon: Users, permission: "employees.manage" },
  { label: "Roles", href: "/roles", icon: Shield, permission: "roles.manage" },
  { label: "Salón", href: "/salon", icon: Settings, permission: "salon.manage" },
];

interface SidebarProps {
  salonName: string;
  userPermissions: Permission[];
  isOwner: boolean;
}

export function Sidebar({ salonName, userPermissions, isOwner }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || isOwner || userPermissions.includes(item.permission)
  );

  return (
    <aside className="flex h-full w-64 flex-col border-r border-violet-100 bg-white shadow-[1px_0_8px_rgba(0,0,0,0.04)]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-violet-50">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900 truncate">{salonName}</p>
          <p className="text-xs text-violet-400 font-medium">GlowBook</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-violet-50 text-violet-700"
                      : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-violet-600" : "text-stone-400")} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-violet-50 p-3">
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors"
          >
            <LogOut className="h-4 w-4 text-stone-400" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
