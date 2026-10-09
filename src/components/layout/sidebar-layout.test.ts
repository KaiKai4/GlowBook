import { describe, expect, it } from "vitest";
import { ASIDE_WIDTH, resolveSidebarCollapsed } from "./sidebar-layout";

describe("resolveSidebarCollapsed", () => {
  it("sin preferencia decide el ancho: plegada en móvil, desplegada en escritorio", () => {
    expect(resolveSidebarCollapsed("auto", false)).toBe(true);
    expect(resolveSidebarCollapsed("auto", true)).toBe(false);
  });

  it("una preferencia guardada manda en cualquier ancho", () => {
    expect(resolveSidebarCollapsed("collapsed", true)).toBe(true);
    expect(resolveSidebarCollapsed("collapsed", false)).toBe(true);
    expect(resolveSidebarCollapsed("expanded", true)).toBe(false);
    expect(resolveSidebarCollapsed("expanded", false)).toBe(false);
  });
});

describe("clases por modo", () => {
  it("el modo automático lleva la anchura plegada y la de escritorio como variante md", () => {
    expect(ASIDE_WIDTH.auto.split(" ")).toEqual(["w-20", "md:w-64"]);
  });

  it("los modos fijos no llevan variantes responsivas", () => {
    expect(ASIDE_WIDTH.collapsed).toBe("w-20");
    expect(ASIDE_WIDTH.expanded).toBe("w-64");
  });
});
