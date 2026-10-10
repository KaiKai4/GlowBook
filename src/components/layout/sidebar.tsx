"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

import { GlowBookBrand, GlowBookMark } from "@/components/brand/glowbook-logo";
import { cn } from "@/components/ui/cn";

import type { NavGroup } from "./nav-items";
import {
  ASIDE_WIDTH,
  BRAND_MARK,
  BRAND_TEXT,
  TOGGLE_POSITION,
} from "./sidebar-layout";
import { SidebarLogout } from "./sidebar-logout";
import { SidebarNav } from "./sidebar-nav";
import type { SidebarPreference } from "./sidebar-store";
import { useSidebarState } from "./use-sidebar-state";
import { useNavigationGuard } from "./unsaved-changes";

interface SidebarProps {
  salonName: string;
  /** Módulos ya filtrados por el servidor (layout del dashboard). */
  groups: NavGroup[];
}

/**
 * Icono del botón de plegar. En "auto" se pintan los dos y el CSS muestra el que
 * corresponde a cada ancho, así el primer render ya es correcto.
 */
function ToggleIcon({
  preference,
  isCollapsed,
}: {
  preference: SidebarPreference;
  isCollapsed: boolean;
}) {
  if (preference === "auto") {
    return (
      <>
        <PanelLeftOpen className="h-4 w-4 md:hidden" aria-hidden="true" />
        <PanelLeftClose className="hidden h-4 w-4 md:block" aria-hidden="true" />
      </>
    );
  }
  if (isCollapsed) {
    return <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />;
  }
  return <PanelLeftClose className="h-4 w-4" aria-hidden="true" />;
}

export function Sidebar({ salonName, groups }: SidebarProps) {
  const pathname = usePathname();
  const confirmNavigate = useNavigationGuard();
  const { preference, isCollapsed, toggleSidebar } = useSidebarState();

  function handleNav(event: MouseEvent, href: string) {
    if (!confirmNavigate) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    confirmNavigate(href);
  }

  return (
    <aside
      id="dashboard-sidebar"
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r border-brand-100 bg-surface shadow-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none",
        ASIDE_WIDTH[preference],
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
          TOGGLE_POSITION[preference],
        )}
      >
        <ToggleIcon preference={preference} isCollapsed={isCollapsed} />
      </button>

      <div className="relative h-[138px] shrink-0 border-b border-brand-50">
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center gap-1.5 px-6 pb-3 pt-5 text-center transition-opacity duration-150 motion-reduce:transition-none",
            BRAND_TEXT[preference],
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
            BRAND_MARK[preference],
          )}
          aria-hidden={!isCollapsed}
        >
          <GlowBookMark size="sm" className="h-14 w-14" />
        </div>
      </div>

      <SidebarNav
        groups={groups}
        pathname={pathname}
        preference={preference}
        isCollapsed={isCollapsed}
        onNavigate={handleNav}
      />

      <SidebarLogout preference={preference} isCollapsed={isCollapsed} />
    </aside>
  );
}
