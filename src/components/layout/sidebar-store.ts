// Preferencia del menu lateral: un store tipado y minimo que comparten todas las
// instancias del Sidebar (y las pestañas, via el evento "storage").
// Se lee con useSyncExternalStore.
//
// Tres estados:
// - "auto": sin preferencia guardada. El aspecto lo decide solo el CSS (plegada por
//   debajo de md, desplegada desde md), asi el primer render del servidor ya es
//   correcto y no hay salto de layout al hidratar.
// - "collapsed" / "expanded": preferencia guardada por el usuario; manda en cualquier ancho.

export type SidebarPreference = "auto" | "collapsed" | "expanded";

const SIDEBAR_STORAGE_KEY = "glowbook-sidebar-collapsed";
// Mismo punto que el breakpoint "md" de Tailwind (48rem = 768 px).
const DESKTOP_MEDIA_QUERY = "(min-width: 48rem)";

type SidebarListener = () => void;

const listeners = new Set<SidebarListener>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Preferencia guardada por el usuario, o "auto" si no hay ninguna (o no se puede leer). */
export function getSidebarPreference(): SidebarPreference {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw === "true") return "collapsed";
    if (raw === "false") return "expanded";
    return "auto";
  } catch {
    return "auto";
  }
}

/** Valor del servidor (getServerSnapshot): sin preferencia conocida, decide el CSS. */
export function getServerSidebarPreference(): SidebarPreference {
  return "auto";
}

/** Sin matchMedia (entornos sin layout) se asume escritorio. */
export function isDesktopViewport(): boolean {
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

/** Valor del servidor: no conoce el ancho, asi que asume escritorio hasta que el cliente mide. */
export function getServerDesktopViewport(): boolean {
  return true;
}

/**
 * Persiste el estado plegado como preferencia y avisa a los suscriptores. Devuelve
 * false si el almacenamiento no esta disponible (en ese caso no se notifica nada).
 */
export function setSidebarCollapsed(collapsed: boolean): boolean {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {
    return false;
  }
  notify();
  return true;
}

/**
 * Suscripcion compatible con useSyncExternalStore: reacciona a cambios locales,
 * a cambios hechos en otra pestaña (evento "storage") y a cruces del punto md.
 */
export function subscribeSidebarCollapsed(listener: SidebarListener): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia(DESKTOP_MEDIA_QUERY)
      : null;
  media?.addEventListener("change", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    media?.removeEventListener("change", listener);
  };
}
