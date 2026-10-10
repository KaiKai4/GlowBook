// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, requireElement } from "@/test/ui-shared-dom";
import { getVisibleNavGroups } from "./nav-items";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) =>
      createElement("a", { href, ...rest }, children),
  };
});

vi.mock("@/components/brand/glowbook-logo", () => ({
  GlowBookBrand: () => null,
  GlowBookMark: () => null,
}));

const STORAGE_KEY = "glowbook-sidebar-collapsed";
const DESKTOP_QUERY = "(min-width: 48rem)";

type Listener = () => void;

let originalMatchMedia: PropertyDescriptor | undefined;

interface ViewportStub {
  setDesktop: (desktop: boolean) => void;
}

/** Simula un viewport de escritorio (>= 768 px) o móvil para la barra lateral, con cambios notificables. */
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

function sidebarElement(): HTMLElement {
  return requireElement<HTMLElement>(document, "aside#dashboard-sidebar");
}

function sidebarTokens(): string[] {
  return sidebarElement().className.split(/\s+/).filter(Boolean);
}

function toggleButton(): HTMLButtonElement {
  return requireElement<HTMLButtonElement>(document, "button[aria-controls='dashboard-sidebar']");
}

function renderSidebar(): MountedComponent {
  return mountComponent(
    <Sidebar salonName="Salón Aurora" groups={getVisibleNavGroups({ permissions: [], isOwner: true })} />
  );
}

describe("Sidebar en distintos anchos", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
    restoreViewport();
    window.localStorage.clear();
  });

  it("en móvil y sin preferencia guardada, el CSS la pliega y el estado expuesto también", () => {
    stubViewport(false);
    mounted = renderSidebar();

    expect(sidebarTokens()).toEqual(expect.arrayContaining(["w-20", "md:w-64"]));
    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
    expect(toggleButton().getAttribute("aria-label")).toBe("Expandir menú lateral");
  });

  it("en escritorio y sin preferencia guardada, el CSS la despliega y el estado expuesto también", () => {
    stubViewport(true);
    mounted = renderSidebar();

    expect(sidebarTokens()).toEqual(expect.arrayContaining(["w-20", "md:w-64"]));
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
    expect(toggleButton().getAttribute("aria-label")).toBe("Contraer menú lateral");
  });

  it("sin preferencia, al cruzar el punto md se actualizan el estado expuesto y las etiquetas", () => {
    const viewport = stubViewport(true);
    mounted = renderSidebar();
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");

    act(() => {
      viewport.setDesktop(false);
    });

    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
    expect(sidebarTokens()).toEqual(expect.arrayContaining(["w-20", "md:w-64"]));
  });

  it("en móvil, una preferencia guardada de desplegada se respeta con clases fijas", () => {
    stubViewport(false);
    window.localStorage.setItem(STORAGE_KEY, "false");
    mounted = renderSidebar();

    expect(sidebarTokens()).toContain("w-64");
    expect(sidebarTokens()).not.toContain("w-20");
    expect(sidebarTokens()).not.toContain("md:w-64");
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
  });

  it("en escritorio, una preferencia guardada de plegada se respeta con clases fijas", () => {
    stubViewport(true);
    window.localStorage.setItem(STORAGE_KEY, "true");
    mounted = renderSidebar();

    expect(sidebarTokens()).toContain("w-20");
    expect(sidebarTokens()).not.toContain("w-64");
    expect(sidebarTokens()).not.toContain("md:w-64");
    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("en móvil, el botón despliega la barra y guarda la preferencia", () => {
    stubViewport(false);
    mounted = renderSidebar();

    clickElement(toggleButton());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
    expect(sidebarTokens()).toContain("w-64");
    expect(sidebarTokens()).not.toContain("md:w-64");
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");

    clickElement(toggleButton());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
    expect(sidebarTokens()).toContain("w-20");
    expect(sidebarTokens()).not.toContain("md:w-64");
  });
});
