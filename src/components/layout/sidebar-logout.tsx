"use client";

import { LogOut } from "lucide-react";

import { cn } from "@/components/ui/cn";

import { ITEM_LAYOUT, LABEL_FADE } from "./sidebar-layout";
import type { SidebarPreference } from "./sidebar-store";

interface SidebarLogoutProps {
  preference: SidebarPreference;
  isCollapsed: boolean;
}

export function SidebarLogout({ preference, isCollapsed }: SidebarLogoutProps) {
  return (
    <div className="border-t border-brand-50 p-3">
      <form action="/api/auth/signout" method="post">
        <button
          type="submit"
          title={isCollapsed ? "Cerrar sesión" : undefined}
          aria-label={isCollapsed ? "Cerrar sesión" : undefined}
          className={cn(
            "grid min-h-10 w-full items-center rounded-lg py-2.5 text-sm font-medium text-fg-subtle transition-[background-color,color,grid-template-columns,gap,padding] duration-200 hover:bg-surface-muted hover:text-fg-secondary motion-reduce:transition-none",
            ITEM_LAYOUT[preference],
          )}
        >
          <LogOut
            className="h-4 w-4 shrink-0 text-fg-subtle"
            aria-hidden="true"
          />
          <span
            className={cn(
              "min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none",
              LABEL_FADE[preference],
            )}
          >
            Cerrar sesión
          </span>
        </button>
      </form>
    </div>
  );
}
