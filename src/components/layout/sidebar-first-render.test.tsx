// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireElement } from "@/test/ui-shared-dom";
import { getVisibleNavGroups } from "./nav-items";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", async () => {
  const { createElement: create } = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) =>
      create("a", { href, ...rest }, children),
  };
});

vi.mock("@/components/brand/glowbook-logo", () => ({
  GlowBookBrand: () => null,
  GlowBookMark: () => null,
}));

const STORAGE_KEY = "glowbook-sidebar-collapsed";

/** Renderiza en el servidor (sin ancho conocido) y monta el HTML resultante en el DOM. */
function serverRender(): HTMLElement {
  const html = renderToStaticMarkup(
    createElement(Sidebar, {
      salonName: "Salón Aurora",
      groups: getVisibleNavGroups({ permissions: [], isOwner: true, disabledFeatures: [] }),
    }),
  );
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

function tokensOf(element: Element): string[] {
  return (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

describe("Sidebar: primer render del servidor", () => {
  let container: HTMLElement | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    container?.remove();
    container = null;
  });

  it("la barra usa anchura responsiva: plegada por debajo de md y desplegada desde md", () => {
    container = serverRender();

    const tokens = tokensOf(requireElement<HTMLElement>(container, "aside#dashboard-sidebar"));
    expect(tokens).toEqual(expect.arrayContaining(["w-20", "md:w-64"]));
    expect(tokens).not.toContain("w-64");
  });

  it("el resto del layout también es responsivo y no fija una variante", () => {
    container = serverRender();

    const brandText = requireElement<HTMLElement>(container, "aside > div:nth-child(2) > div:first-child");
    expect(tokensOf(brandText)).toEqual(expect.arrayContaining(["pointer-events-none", "opacity-0", "md:opacity-100"]));

    const nav = requireElement<HTMLElement>(container, "aside nav");
    expect(tokensOf(nav)).toEqual(expect.arrayContaining(["px-2", "md:px-3"]));

    const link = requireElement<HTMLAnchorElement>(container, "aside nav a");
    expect(tokensOf(link)).toEqual(
      expect.arrayContaining(["grid-cols-[16px_0fr]", "md:grid-cols-[16px_1fr]", "md:justify-normal"]),
    );
  });

  it("el botón de plegar lleva los dos iconos y el CSS elige el visible", () => {
    container = serverRender();

    const toggle = requireElement<HTMLButtonElement>(container, "button[aria-controls='dashboard-sidebar']");
    const svgs = Array.from(toggle.querySelectorAll("svg")).map((svg) => tokensOf(svg));
    expect(svgs).toHaveLength(2);
    expect(svgs[0]).toContain("md:hidden");
    expect(svgs[1]).toEqual(expect.arrayContaining(["hidden", "md:block"]));
  });

  it("ignora la preferencia guardada: el primer render es siempre automático", () => {
    window.localStorage.setItem(STORAGE_KEY, "true");

    container = serverRender();

    const tokens = tokensOf(requireElement<HTMLElement>(container, "aside#dashboard-sidebar"));
    expect(tokens).toEqual(expect.arrayContaining(["w-20", "md:w-64"]));
    expect(tokens).not.toContain("w-64");
  });
});
