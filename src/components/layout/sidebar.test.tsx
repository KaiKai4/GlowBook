// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Permission } from "@/lib/auth/permissions";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, requireElement } from "@/test/ui-shared-dom";
import { Sidebar } from "./sidebar";
import { UnsavedChangesProvider, useUnsavedChanges } from "./unsaved-changes";

const { pushMock, pathnameState } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  pathnameState: { value: "/" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({ push: pushMock }),
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

function sidebarElement(): HTMLElement {
  return requireElement<HTMLElement>(document, "aside#dashboard-sidebar");
}

function toggleButton(): HTMLButtonElement {
  return requireElement<HTMLButtonElement>(document, "button[aria-controls='dashboard-sidebar']");
}

function linkTo(label: string): HTMLAnchorElement {
  const match = Array.from(document.querySelectorAll<HTMLAnchorElement>("nav a")).find(
    (link) => link.textContent === label || link.getAttribute("aria-label") === label
  );
  if (!match) throw new Error(`Falta el enlace ${label}`);
  return match;
}

function DirtyForm() {
  useUnsavedChanges(true);
  return null;
}

function renderSidebar(
  permissions: Permission[] = [],
  isOwner = false,
  options: { guarded?: boolean; disabledFeatures?: Parameters<typeof Sidebar>[0]["disabledFeatures"] } = {}
): MountedComponent {
  const sidebar = (
    <Sidebar
      salonName="Salón Aurora"
      userPermissions={permissions}
      isOwner={isOwner}
      disabledFeatures={options.disabledFeatures ?? []}
    />
  );
  return mountComponent(
    options.guarded ? (
      <UnsavedChangesProvider>
        {sidebar}
        <DirtyForm />
      </UnsavedChangesProvider>
    ) : (
      <UnsavedChangesProvider>{sidebar}</UnsavedChangesProvider>
    )
  );
}

describe("Sidebar", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    pathnameState.value = "/";
    pushMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("muestra el nombre del salón y todos los módulos al propietario", () => {
    mounted = renderSidebar([], true);

    expect(mounted.container.textContent).toContain("Salón Aurora");
    expect(linkTo("Citas").getAttribute("href")).toBe("/appointments");
    expect(linkTo("Reportes").getAttribute("href")).toBe("/reports");
    expect(linkTo("Salon").getAttribute("href")).toBe("/salon");
  });

  it("agrupa los módulos con su encabezado de sección cuando está expandida", () => {
    mounted = renderSidebar([], true);

    const headers = Array.from(document.querySelectorAll("nav p")).map((node) => node.textContent);
    expect(headers).toEqual(expect.arrayContaining(["Agenda", "Gestión", "Administración"]));
  });

  it("sin permisos solo queda el inicio, y se avisa de que no hay módulos asignados", () => {
    // "Inicio" no exige permisos, pero el aviso depende de que no haya ningún módulo además de él.
    mounted = renderSidebar([], false);

    expect(mounted.container.textContent).toContain("No tienes módulos asignados.");
    expect(mounted.container.querySelectorAll("nav a").length).toBe(1);
  });

  it("muestra solo los módulos cuyo permiso tiene el usuario", () => {
    mounted = renderSidebar(["customers.manage"], false);

    const labels = Array.from(document.querySelectorAll("nav a")).map((link) => link.textContent);
    expect(labels).toEqual(["Inicio", "Clientes"]);
  });

  it("resalta el módulo activo según la ruta, y el inicio solo en la raíz", () => {
    pathnameState.value = "/customers/123";
    mounted = renderSidebar(["customers.manage"], false);
    expect(linkTo("Clientes").className).toContain("bg-brand-50");
    expect(linkTo("Inicio").className).not.toContain("bg-brand-50");
  });

  it("en la raíz el inicio aparece como activo", () => {
    pathnameState.value = "/";
    mounted = renderSidebar([], false);

    expect(linkTo("Inicio").className).toContain("bg-brand-50");
  });

  it("el botón de contraer alterna el ancho, lo guarda y actualiza su etiqueta", () => {
    mounted = renderSidebar([], true);
    expect(sidebarElement().className).toContain("w-64");
    expect(toggleButton().getAttribute("aria-label")).toBe("Contraer menú lateral");
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");

    clickElement(toggleButton());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
    expect(sidebarElement().className).toContain("w-20");
    expect(toggleButton().getAttribute("aria-label")).toBe("Expandir menú lateral");
    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");

    clickElement(toggleButton());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
    expect(sidebarElement().className).toContain("w-64");
  });

  it("arranca contraída si así quedó guardado", () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    mounted = renderSidebar([], true);

    expect(sidebarElement().className).toContain("w-20");
    expect(linkTo("Citas").getAttribute("aria-label")).toBe("Citas");
  });

  it("si no se puede guardar la preferencia, no cambia de estado", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("almacenamiento bloqueado");
    });
    mounted = renderSidebar([], true);

    clickElement(toggleButton());

    expect(sidebarElement().className).toContain("w-64");
  });

  it("si el almacenamiento falla al leer, arranca expandida", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("almacenamiento bloqueado");
    });
    mounted = renderSidebar([], true);

    expect(sidebarElement().className).toContain("w-64");
  });

  it("contraída: los enlaces y el cierre de sesión quedan etiquetados para lectores de pantalla", () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    mounted = renderSidebar([], true);

    expect(linkTo("Inicio").getAttribute("title")).toBe("Inicio");
    const logout = findButtonByText(document, "Cerrar sesión");
    expect(logout.getAttribute("aria-label")).toBe("Cerrar sesión");
  });

  it("el cierre de sesión es un formulario POST hacia la ruta de signout", () => {
    mounted = renderSidebar([], false);

    const form = requireElement<HTMLFormElement>(document, 'form[action="/api/auth/signout"]');
    expect(form.method.toLowerCase()).toBe("post");
    expect(findButtonByText(form, "Cerrar sesión").type).toBe("submit");
  });

  it("sin cambios pendientes, un clic en un módulo navega con el router y evita la navegación nativa", () => {
    mounted = renderSidebar(["customers.manage"], false);
    const link = linkTo("Clientes");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    act(() => {
      link.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(pushMock).toHaveBeenCalledWith("/customers");
  });

  it("con cambios sin guardar, un clic en un módulo abre la confirmación y no navega", () => {
    mounted = renderSidebar(["customers.manage"], false, { guarded: true });

    clickElement(linkTo("Clientes"));

    expect(pushMock).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe("Cambios sin guardar");
  });

  it("con Ctrl o Shift pulsados deja que el navegador abra el enlace (p. ej. en otra pestaña)", () => {
    mounted = renderSidebar(["customers.manage"], false, { guarded: true });
    const link = linkTo("Clientes");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    // Registra si React canceló el evento; después lo cancela aquí para que jsdom no intente navegar.
    let preventedByReact: boolean | null = null;
    const recorder = (received: Event) => {
      preventedByReact = received.defaultPrevented;
      received.preventDefault();
    };
    document.addEventListener("click", recorder);

    act(() => {
      link.dispatchEvent(event);
    });
    document.removeEventListener("click", recorder);

    expect(preventedByReact).toBe(false);
    expect(pushMock).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
