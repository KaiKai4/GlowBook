"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { GlowBookBrand, GlowBookMark } from "@/components/brand/glowbook-logo";
import type { Permission } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils/cn";
import type { SalonFeatureKey } from "@/features/salon/domain/salon-features";

import { getVisibleNavGroups } from "./nav-items";
import { useNavigationGuard } from "./unsaved-changes";

interface SidebarProps {
  salonName: string;
  userPermissions: Permission[];
  isOwner: boolean;
  disabledFeatures: SalonFeatureKey[];
}

const SIDEBAR_STORAGE_KEY = "glowbook-sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "glowbook-sidebar-change";

function getSidebarSnapshot() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribeToSidebarState(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  };
}

export function Sidebar({
  salonName,
  userPermissions,
  isOwner,
  disabledFeatures,
}: SidebarProps) {
  const pathname = usePathname();
  const confirmNavigate = useNavigationGuard();
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarState,
    getSidebarSnapshot,
    () => false,
  );

  const groups = getVisibleNavGroups(
    userPermissions,
    isOwner,
    disabledFeatures,
  );

  function toggleSidebar() {
    const next = !isCollapsed;

    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      return;
    }

    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
  }

  function handleNav(event: React.MouseEvent, href: string) {
    if (!confirmNavigate) return;
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    confirmNavigate(href);
  }

  return (
    <aside
      id="dashboard-sidebar"
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r border-brand-100 bg-surface shadow-[1px_0_8px_rgba(0,0,0,0.04)] transition-[width] duration-200 ease-out motion-reduce:transition-none",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-controls="dashboard-sidebar"
        aria-expanded={!isCollapsed}
        aria-label={
          isCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"
        }
        title={isCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
        className={cn(
          "absolute z-20 flex h-7 w-7 items-center justify-center rounded-full border border-brand-100 bg-surface text-fg-subtle shadow-sm transition-[border-color,color,box-shadow] duration-150 hover:border-brand-400 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
          isCollapsed
            ? "left-1/2 top-[88px] -translate-x-1/2"
            : "right-12 top-[88px]",
        )}
      >
        {isCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <div className="relative h-[138px] shrink-0 border-b border-brand-50">
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center gap-1.5 px-6 pb-3 pt-5 text-center transition-opacity duration-150 motion-reduce:transition-none",
            isCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          aria-hidden={isCollapsed}
        >
          <GlowBookBrand markSize="sm" align="center" />
          <div className="min-w-0 max-w-full">
            <p className="break-words text-sm font-semibold leading-tight text-fg">
              {salonName}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "absolute inset-0 flex justify-center pt-4 transition-opacity duration-150 motion-reduce:transition-none",
            isCollapsed ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!isCollapsed}
        >
          <GlowBookMark size="sm" className="h-14 w-14" />
        </div>
      </div>

      <nav
        className={cn(
          "flex-1 overflow-y-auto pb-4 pt-3 transition-[padding] duration-200 motion-reduce:transition-none",
          isCollapsed ? "px-2" : "px-3",
        )}
      >
        {groups.length === 0 ? (
          <p
            className={cn(
              "px-3 py-4 text-xs leading-relaxed text-fg-subtle",
              isCollapsed && "sr-only",
            )}
          >
            No tienes módulos asignados. Pide al administrador que configure tu
            rol.
          </p>
        ) : (
          <div
            className={cn(
              isCollapsed ? "space-y-3" : "space-y-5",
            )}
          >
            {groups.map((group, groupIndex) => (
              <div
                key={group.label ?? `group-${groupIndex}`}
                className={cn(
                  isCollapsed &&
                    groupIndex > 0 &&
                    "border-t border-brand-50 pt-3",
                )}
              >
                {group.label && !isCollapsed ? (
                  <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                    {group.label}
                  </p>
                ) : null}

                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={(event) => handleNav(event, item.href)}
                          title={isCollapsed ? item.label : undefined}
                          aria-label={isCollapsed ? item.label : undefined}
                          className={cn(
                            "grid min-h-10 items-center rounded-lg py-2.5 text-sm font-medium transition-[background-color,color,grid-template-columns,gap,padding] duration-200 motion-reduce:transition-none",
                            isCollapsed
                              ? "grid-cols-[16px_0fr] justify-center gap-0 px-3"
                              : "grid-cols-[16px_1fr] gap-3 px-3",
                            isActive
                              ? "bg-brand-50 text-brand-700"
                              : "text-fg-subtle hover:bg-surface-muted hover:text-fg-secondary",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-brand-600" : "text-fg-subtle",
                            )}
                            aria-hidden="true"
                          />
                          <span
                            className={cn(
                              "min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none",
                              isCollapsed ? "opacity-0" : "opacity-100",
                            )}
                          >
                            {item.label}
                          </span>
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

      <div className="border-t border-brand-50 p-3">
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            title={isCollapsed ? "Cerrar sesión" : undefined}
            aria-label={isCollapsed ? "Cerrar sesión" : undefined}
            className={cn(
              "grid min-h-10 w-full items-center rounded-lg py-2.5 text-sm font-medium text-fg-subtle transition-[background-color,color,grid-template-columns,gap,padding] duration-200 hover:bg-surface-muted hover:text-fg-secondary motion-reduce:transition-none",
              isCollapsed
                ? "grid-cols-[16px_0fr] justify-center gap-0 px-3"
                : "grid-cols-[16px_1fr] gap-3 px-3",
            )}
          >
            <LogOut
              className="h-4 w-4 shrink-0 text-fg-subtle"
              aria-hidden="true"
            />
            <span
              className={cn(
                "min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none",
                isCollapsed ? "opacity-0" : "opacity-100",
              )}
            >
              Cerrar sesión
            </span>
          </button>
        </form>
      </div>
    </aside>
  );
}
