"use client";

import { useSyncExternalStore } from "react";

import { resolveSidebarCollapsed } from "./sidebar-layout";
import {
  getServerDesktopViewport,
  getServerSidebarPreference,
  getSidebarPreference,
  isDesktopViewport,
  setSidebarCollapsed,
  subscribeSidebarCollapsed,
} from "./sidebar-store";
import type { SidebarPreference } from "./sidebar-store";

export interface SidebarState {
  preference: SidebarPreference;
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

/**
 * Estado del sidebar: preferencia guardada, viewport y el estado efectivo.
 * El primer render del servidor usa los valores por defecto (sin desajustes).
 */
export function useSidebarState(): SidebarState {
  const preference = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarPreference,
    getServerSidebarPreference,
  );
  const desktop = useSyncExternalStore(
    subscribeSidebarCollapsed,
    isDesktopViewport,
    getServerDesktopViewport,
  );
  // Estado efectivo: solo para atributos y etiquetas (no mueve el layout en "auto").
  const isCollapsed = resolveSidebarCollapsed(preference, desktop);

  function toggleSidebar() {
    setSidebarCollapsed(!isCollapsed);
  }

  return { preference, isCollapsed, toggleSidebar };
}
