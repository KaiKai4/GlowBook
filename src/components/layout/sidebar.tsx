"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { GlowBookBrand } from "@/components/brand/glowbook-logo";
import { LogOut } from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";
import type { SalonFeatureKey } from "@/features/salon/domain/salon-features";
import { getVisibleNavGroups } from "./nav-items";
import { useNavigationGuard } from "./unsaved-changes";

interface SidebarProps {
  salonName: string;
  userPermissions: Permission[];
  isOwner: boolean;
  disabledFeatures: SalonFeatureKey[];
}

export function Sidebar({ salonName, userPermissions, isOwner, disabledFeatures }: SidebarProps) {
  const pathname = usePathname();
  const confirmNavigate = useNavigationGuard();

  const groups = getVisibleNavGroups(userPermissions, isOwner, disabledFeatures);

  function handleNav(e: React.MouseEvent, href: string) {
    if (!confirmNavigate) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    confirmNavigate(href);
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-brand-100 bg-white shadow-[1px_0_8px_rgba(0,0,0,0.04)]">
      {/* Brand */}
      <div className="flex flex-col items-center gap-1.5 px-6 pb-3 pt-5 text-center border-b border-brand-50">
        <GlowBookBrand markSize="sm" align="center" />
        <div className="min-w-0 max-w-full">
          <p className="text-sm font-semibold leading-tight text-stone-900 break-words">{salonName}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
        {groups.length === 0 ? (
          <p className="px-3 py-4 text-xs text-stone-400 leading-relaxed">
            No tienes módulos asignados. Pide al administrador que configure tu rol.
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((group, gi) => (
              <div key={group.label ?? `group-${gi}`}>
                {group.label && (
                  <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                    {group.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={(e) => handleNav(e, item.href)}
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
              </div>
            ))}
          </div>
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
