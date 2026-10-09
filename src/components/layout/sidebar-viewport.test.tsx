// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, requireElement } from "@/test/ui-shared-dom";
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

let originalMatchMedia: PropertyDescriptor | undefined;

/** Simula un viewport de escritorio (>= 768 px) o móvil para la barra lateral. */
function stubViewport(desktop: boolean) {
  originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      media: DESKTOP_QUERY,
      matches: desktop,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  });
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

function toggleButton(): HTMLButtonElement {
  return requireElement<HTMLButtonElement>(document, "button[aria-controls='dashboard-sidebar']");
}

function renderSidebar(): MountedComponent {
  return mountComponent(
    <Sidebar salonName="Salón Aurora" userPermissions={[]} isOwner={true} disabledFeatures={[]} />
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

  it("en móvil y sin preferencia guardada, arranca plegada", () => {
    stubViewport(false);
    mounted = renderSidebar();

    expect(sidebarElement().className).toContain("w-20");
    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
    expect(toggleButton().getAttribute("aria-label")).toBe("Expandir menú lateral");
  });

  it("en escritorio y sin preferencia guardada, arranca desplegada", () => {
    stubViewport(true);
    mounted = renderSidebar();

    expect(sidebarElement().className).toContain("w-64");
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
  });

  it("en móvil, una preferencia guardada de desplegada se respeta", () => {
    stubViewport(false);
    window.localStorage.setItem(STORAGE_KEY, "false");
    mounted = renderSidebar();

    expect(sidebarElement().className).toContain("w-64");
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
  });

  it("en escritorio, una preferencia guardada de plegada se respeta", () => {
    stubViewport(true);
    window.localStorage.setItem(STORAGE_KEY, "true");
    mounted = renderSidebar();

    expect(sidebarElement().className).toContain("w-20");
    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("en móvil, el botón despliega la barra y guarda la preferencia", () => {
    stubViewport(false);
    mounted = renderSidebar();

    clickElement(toggleButton());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
    expect(sidebarElement().className).toContain("w-64");
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");

    clickElement(toggleButton());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
    expect(sidebarElement().className).toContain("w-20");
  });
});
