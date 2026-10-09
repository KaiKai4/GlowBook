// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { PlatformAdminSidebar } from "./platform-admin-sidebar";

const currentPath = vi.hoisted(() => ({ value: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => currentPath.value }));

function activeLinks(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a[aria-current="page"]')).map(
    (link) => link.getAttribute("href") ?? ""
  );
}

describe("PlatformAdminSidebar", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("marca como página actual solo el inicio en la raíz del panel", () => {
    currentPath.value = "/admin";
    mounted = mountComponent(<PlatformAdminSidebar />);

    expect(activeLinks(mounted.container)).toEqual(["/admin"]);
  });

  it("marca la sección cuyo prefijo coincide con la ruta actual", () => {
    currentPath.value = "/admin/plans/123";
    mounted = mountComponent(<PlatformAdminSidebar />);

    expect(activeLinks(mounted.container)).toEqual(["/admin/plans"]);
    const planLink = mounted.container.querySelector('a[href="/admin/plans"]');
    expect(planLink?.className).toContain("text-brand-700");
  });

  it("deja las demás secciones con el estilo inactivo", () => {
    currentPath.value = "/admin/salons";
    mounted = mountComponent(<PlatformAdminSidebar />);

    const inactive = mounted.container.querySelector('a[href="/admin/plans"]');
    expect(inactive?.getAttribute("aria-current")).toBeNull();
    expect(inactive?.className).toContain("text-fg-subtle");
  });
});
