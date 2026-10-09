// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getCommercialPlansPage } from "@/features/billing/use-cases/commercial-plans";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { makeCommercialPlansData } from "@/test/ui-admin-page-fixtures";
import PlatformPlansPage from "./page";

vi.mock("@/lib/auth/session", () => ({ requirePlatformAdmin: vi.fn(async () => "admin-1") }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  getCommercialPlansPage: vi.fn(),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) =>
      React.createElement("a", { href, className }, children),
  };
});
vi.mock("./actions", () => ({
  savePlanAction: vi.fn(),
  removePlanAction: vi.fn(),
  savePlanModulesAction: vi.fn(),
  savePlanLimitsAction: vi.fn(),
  saveAddonAction: vi.fn(),
  removeAddonAction: vi.fn(),
}));

async function render(searchParams?: { new?: string; view?: string }): Promise<MountedComponent> {
  return mountComponent(await PlatformPlansPage({ searchParams: searchParams ? Promise.resolve(searchParams) : undefined }));
}

function linkByText(container: HTMLElement, text: string): HTMLAnchorElement | undefined {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find((anchor) => anchor.textContent === text);
}

describe("PlatformPlansPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(getCommercialPlansPage).mockResolvedValue(makeCommercialPlansData());
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("exige rol de plataforma y carga el catálogo comercial", async () => {
    mounted = await render();

    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(getCommercialPlansPage).toHaveBeenCalledTimes(1);
  });

  it("muestra el número de planes, planes activos, salones asignados y extras", async () => {
    mounted = await render();

    expect(mounted.container.querySelector("h1")?.textContent).toBe("Planes y extras");
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Planes");
    expect(text).toContain("Activos");
    expect(text).toContain("Asignados");
    expect(text).toContain("Extras");
    const metricValues = Array.from(mounted.container.querySelectorAll("span.text-xl")).map((span) => span.textContent);
    expect(metricValues).toEqual(["2", "1", "2", "1"]);
  });

  it("en la vista de planes ofrece crear un plan en modo creación", async () => {
    mounted = await render();

    expect(linkByText(mounted.container, "Nuevo plan")?.getAttribute("href")).toBe("/admin/plans?new=1#new-plan");
    expect(mounted.container.textContent).toContain("Crea planes comerciales");
    expect(mounted.container.querySelector("h2")?.textContent).toBe("Pro");
  });

  it("abre el editor en modo creación cuando la URL trae new=1", async () => {
    mounted = await render({ new: "1" });

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Nuevo plan");
  });

  it("en la vista de extras muestra el catálogo y oculta el botón de nuevo plan", async () => {
    mounted = await render({ view: "addons" });

    expect(linkByText(mounted.container, "Nuevo plan")).toBeUndefined();
    expect(mounted.container.textContent).toContain("Define el catalogo de extras");
    expect(mounted.container.textContent).toContain("Nuevo extra");
    expect(mounted.container.textContent).toContain("1 en catalogo");
  });

  it("enlaza las pestañas Planes y Extras y marca la activa", async () => {
    mounted = await render({ view: "addons" });

    expect(linkByText(mounted.container, "Planes")?.getAttribute("href")).toBe("/admin/plans");
    expect(linkByText(mounted.container, "Extras")?.getAttribute("href")).toBe("/admin/plans?view=addons");
    expect(linkByText(mounted.container, "Extras")?.className).toContain("bg-brand-600");
    expect(linkByText(mounted.container, "Planes")?.className).not.toContain("bg-brand-600");
  });

  it("trata cualquier valor de view distinto de addons como la vista de planes", async () => {
    mounted = await render({ view: "otra" });

    expect(mounted.container.textContent).toContain("Crea planes comerciales");
    expect(linkByText(mounted.container, "Nuevo plan")).toBeDefined();
  });
});
