// Estado del menu lateral colapsado: un store tipado y minimo que comparten
// todas las instancias del Sidebar (y las pestañas, via el evento "storage").
// Se lee con useSyncExternalStore; sustituye al CustomEvent global anterior.

const SIDEBAR_STORAGE_KEY = "glowbook-sidebar-collapsed";

type SidebarListener = () => void;

const listeners = new Set<SidebarListener>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Lee el estado guardado. Sin acceso a localStorage (modo privado, bloqueado) => expandido. */
export function getSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
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
 * Suscripcion compatible con useSyncExternalStore: reacciona a cambios locales
 * y a cambios hechos en otra pestaña (evento "storage").
 */
export function subscribeSidebarCollapsed(listener: SidebarListener): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
