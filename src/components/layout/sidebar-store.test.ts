// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSidebarCollapsed, setSidebarCollapsed, subscribeSidebarCollapsed } from "./sidebar-store";

const SIDEBAR_STORAGE_KEY = "glowbook-sidebar-collapsed";

describe("sidebar-store", () => {
  const unsubscribers: Array<() => void> = [];

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    vi.restoreAllMocks();
  });

  function subscribe(listener: () => void) {
    const unsubscribe = subscribeSidebarCollapsed(listener);
    unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  it("parte expandido cuando no hay preferencia guardada", () => {
    expect(getSidebarCollapsed()).toBe(false);
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

  it("si localStorage falla al escribir no cambia nada ni notifica", () => {
    const listener = vi.fn();
    subscribe(listener);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(setSidebarCollapsed(true)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("si localStorage falla al leer se considera expandido", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(getSidebarCollapsed()).toBe(false);
  });
});
