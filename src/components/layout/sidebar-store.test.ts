// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getServerSidebarCollapsed,
  getSidebarCollapsed,
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

  it("sin matchMedia y sin preferencia se considera escritorio: expandido", () => {
    expect(getSidebarCollapsed()).toBe(false);
  });

  it("sin preferencia guardada en móvil (< 768 px) arranca plegada", () => {
    stubViewport(false);

    expect(getSidebarCollapsed()).toBe(true);
  });

  it("sin preferencia guardada en escritorio (>= 768 px) arranca desplegada", () => {
    stubViewport(true);

    expect(getSidebarCollapsed()).toBe(false);
  });

  it("una preferencia guardada se respeta en móvil y en escritorio", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "false");
    stubViewport(false);
    expect(getSidebarCollapsed()).toBe(false);

    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "true");
    restoreViewport();
    stubViewport(true);
    expect(getSidebarCollapsed()).toBe(true);
  });

  it("un valor guardado no reconocido se trata como ausencia de preferencia", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "quizas");
    stubViewport(false);

    expect(getSidebarCollapsed()).toBe(true);
  });

  it("si localStorage no se puede leer, decide el ancho", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    stubViewport(false);

    expect(getSidebarCollapsed()).toBe(true);
  });

  it("el servidor renderiza como escritorio (desplegada)", () => {
    expect(getServerSidebarCollapsed()).toBe(false);
  });

  it("guarda el estado y lo lee de vuelta", () => {
    expect(setSidebarCollapsed(true)).toBe(true);
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("true");
    expect(getSidebarCollapsed()).toBe(true);

    setSidebarCollapsed(false);
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("false");
    expect(getSidebarCollapsed()).toBe(false);
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

  it("al cruzar el punto md sin preferencia avisa y recalcula el estado", () => {
    const viewport = stubViewport(true);
    const listener = vi.fn();
    subscribe(listener);
    expect(getSidebarCollapsed()).toBe(false);

    viewport.setDesktop(false);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getSidebarCollapsed()).toBe(true);
  });

  it("al cruzar el punto md con preferencia guardada no cambia el estado", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "false");
    const viewport = stubViewport(true);
    subscribe(vi.fn());

    viewport.setDesktop(false);

    expect(getSidebarCollapsed()).toBe(false);
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

  it("si localStorage falla al leer se considera expandido en escritorio", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(getSidebarCollapsed()).toBe(false);
  });
});
