// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getServerDesktopViewport,
  getServerSidebarPreference,
  getSidebarPreference,
  isDesktopViewport,
  setSidebarCollapsed,
  subscribeSidebarCollapsed,
} from "./sidebar-store";

const SIDEBAR_STORAGE_KEY = "glowbook-sidebar-collapsed";
const DESKTOP_QUERY = "(min-width: 48rem)";

type Listener = () => void;

interface ViewportStub {
  setDesktop: (desktop: boolean) => void;
  changeListeners: Set<Listener>;
}

let originalMatchMedia: PropertyDescriptor | undefined;

/** Simula un viewport de escritorio (>= 768 px) o móvil, con cambios notificables. */
function stubViewport(desktop: boolean): ViewportStub {
  originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  const changeListeners = new Set<Listener>();
  const mediaQueryList = {
    media: DESKTOP_QUERY,
    matches: desktop,
    addEventListener: (_type: string, listener: Listener) => {
      changeListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      changeListeners.delete(listener);
    },
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => mediaQueryList),
  });
  return {
    changeListeners,
    setDesktop(value: boolean) {
      mediaQueryList.matches = value;
      changeListeners.forEach((listener) => listener());
    },
  };
}

function restoreViewport() {
  if (originalMatchMedia) {
    Object.defineProperty(window, "matchMedia", originalMatchMedia);
  } else {
    Reflect.deleteProperty(window, "matchMedia");
  }
  originalMatchMedia = undefined;
}

describe("sidebar-store", () => {
  const unsubscribers: Array<() => void> = [];

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    restoreViewport();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  function subscribe(listener: () => void) {
    const unsubscribe = subscribeSidebarCollapsed(listener);
    unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  it("sin preferencia guardada el modo es automático, sin importar el ancho", () => {
    expect(getSidebarPreference()).toBe("auto");
    stubViewport(false);
    expect(getSidebarPreference()).toBe("auto");
  });

  it("una preferencia guardada se lee como plegada o desplegada", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "true");
    expect(getSidebarPreference()).toBe("collapsed");

    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "false");
    expect(getSidebarPreference()).toBe("expanded");
  });

  it("un valor guardado no reconocido se trata como ausencia de preferencia", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "quizas");

    expect(getSidebarPreference()).toBe("auto");
  });

  it("si localStorage no se puede leer, el modo es automático", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(getSidebarPreference()).toBe("auto");
  });

  it("el servidor siempre renderiza en modo automático, sin conocer localStorage", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "true");

    expect(getServerSidebarPreference()).toBe("auto");
    expect(getServerDesktopViewport()).toBe(true);
  });

  it("sin matchMedia se asume escritorio", () => {
    expect(isDesktopViewport()).toBe(true);
  });

  it("detecta el ancho con matchMedia", () => {
    stubViewport(false);
    expect(isDesktopViewport()).toBe(false);

    restoreViewport();
    stubViewport(true);
    expect(isDesktopViewport()).toBe(true);
  });

  it("guarda el estado y lo lee de vuelta", () => {
    expect(setSidebarCollapsed(true)).toBe(true);
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("true");
    expect(getSidebarPreference()).toBe("collapsed");

    setSidebarCollapsed(false);
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("false");
    expect(getSidebarPreference()).toBe("expanded");
  });

  it("notifica a los suscriptores en cada cambio local", () => {
    const listener = vi.fn();
    subscribe(listener);

    setSidebarCollapsed(true);
    setSidebarCollapsed(false);

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("deja de notificar tras cancelar la suscripcion", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    unsubscribe();
    setSidebarCollapsed(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it("reacciona a cambios de otra pestaña via el evento storage", () => {
    const listener = vi.fn();
    subscribe(listener);

    window.dispatchEvent(new StorageEvent("storage", { key: SIDEBAR_STORAGE_KEY }));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("avisa al cruzar el punto md para que el ancho efectivo se recalcule", () => {
    const viewport = stubViewport(true);
    const listener = vi.fn();
    subscribe(listener);

    viewport.setDesktop(false);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(isDesktopViewport()).toBe(false);
  });

  it("al cancelar la suscripcion también deja de escuchar matchMedia", () => {
    const viewport = stubViewport(true);
    const unsubscribe = subscribeSidebarCollapsed(vi.fn());
    expect(viewport.changeListeners.size).toBe(1);

    unsubscribe();

    expect(viewport.changeListeners.size).toBe(0);
  });

  it("si localStorage falla al escribir no cambia nada ni notifica", () => {
    const listener = vi.fn();
    subscribe(listener);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(setSidebarCollapsed(true)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
