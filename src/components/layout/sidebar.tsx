"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { LogOut, Sparkles } from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";
import { getVisibleNavItems } from "./nav-items";

interface SidebarProps {
  salonName: string;
  userPermissions: Permission[];
  isOwner: boolean;
}

export function Sidebar({ salonName, userPermissions, isOwner }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = getVisibleNavItems(userPermissions, isOwner);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-brand-100 bg-white shadow-[1px_0_8px_rgba(0,0,0,0.04)]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-brand-50">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900 truncate">{salonName}</p>
          <p className="text-xs text-brand-400 font-medium">GlowBook</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleItems.length === 0 ? (
          <p className="px-3 py-4 text-xs text-stone-400 leading-relaxed">
            No tienes módulos asignados. Pide al administrador que configure tu rol.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {visibleItems.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand-600" : "text-stone-400")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-brand-50 p-3">
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
