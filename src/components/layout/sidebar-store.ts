// Estado del menu lateral colapsado: un store tipado y minimo que comparten
// todas las instancias del Sidebar (y las pestañas, via el evento "storage").
// Se lee con useSyncExternalStore; sustituye al CustomEvent global anterior.
//
// Sin preferencia guardada, el estado depende del ancho: por debajo de md (768 px)
// la barra empieza plegada; por encima, desplegada. Una preferencia guardada
// por el usuario manda siempre.

const SIDEBAR_STORAGE_KEY = "glowbook-sidebar-collapsed";
// Mismo punto que el breakpoint "md" de Tailwind (48rem = 768 px).
const DESKTOP_MEDIA_QUERY = "(min-width: 48rem)";

type SidebarListener = () => void;

const listeners = new Set<SidebarListener>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Preferencia guardada por el usuario, o null si no hay ninguna (o no se puede leer). */
function readSavedPreference(): boolean | null {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}

/** Sin matchMedia (entornos sin layout) se asume escritorio. */
function isDesktopViewport(): boolean {
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

/**
 * Estado colapsado para el cliente: la preferencia guardada si existe; si no,
 * plegada en móvil y desplegada en escritorio.
 */
export function getSidebarCollapsed(): boolean {
  const saved = readSavedPreference();
  if (saved !== null) return saved;
  return !isDesktopViewport();
}

/**
 * Valor del servidor (getServerSnapshot): el servidor no conoce el ancho, así que
 * renderiza como escritorio y el cliente corrige tras la hidratación.
 */
export function getServerSidebarCollapsed(): boolean {
  return false;
}

/**
 * Persiste el estado colapsado y avisa a los suscriptores. Devuelve false si el
 * almacenamiento no esta disponible (en ese caso no se notifica ningun cambio).
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
