// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import PlatformAdminLayout from "./layout";

vi.mock("@/lib/auth/session", () => ({ requirePlatformAdmin: vi.fn(async () => "admin-1") }));
vi.mock("./platform-admin-sidebar", async () => {
  const React = await import("react");
  return {
    PlatformAdminSidebar: () => React.createElement("nav", { "aria-label": "Sidebar de plataforma" }, "Sidebar"),
  };
});

describe("PlatformAdminLayout", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.mocked(requirePlatformAdmin).mockResolvedValue("admin-1");
  });

  it("verifica el rol de plataforma antes de renderizar el área de administración", async () => {
    mounted = mountComponent(await PlatformAdminLayout({ children: <p>Contenido</p> }));

    expect(requirePlatformAdmin).toHaveBeenCalledTimes(1);
  });

  it("muestra la barra lateral y el contenido de la página dentro del área principal", async () => {
    mounted = mountComponent(await PlatformAdminLayout({ children: <p>Contenido de prueba</p> }));

    const main = mounted.container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main?.textContent).toContain("Contenido de prueba");
    expect(mounted.container.querySelector('nav[aria-label="Sidebar de plataforma"]')).not.toBeNull();
  });

  it("no renderiza nada del área de administración si el usuario no es admin de plataforma", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(PlatformAdminLayout({ children: <p>Secreto</p> })).rejects.toThrow("NEXT_REDIRECT");
  });
});
