import { describe, expect, it } from "vitest";
import { getVisibleNavGroups, getVisibleNavItems } from "./nav-items";

const labels = (items: Array<{ label: string }>) => items.map((item) => item.label);

describe("getVisibleNavItems", () => {
  it("el propietario ve todas las secciones y el inicio siempre es visible", () => {
    const visible = labels(getVisibleNavItems({ permissions: [], isOwner: true }));

    expect(visible).toEqual([
      "Inicio",
      "Citas",
      "Recordatorios",
      "Clientes",
      "Colaboradores",
      "Servicios",
      "Vitrina",
      "Inventario",
      "Reportes",
      "Gastos",
      "Roles",
      "Plantillas",
      "Salon",
    ]);
  });

  it("un usuario sin permisos solo ve el inicio", () => {
    expect(labels(getVisibleNavItems({ permissions: [], isOwner: false }))).toEqual(["Inicio"]);
  });

  it("muestra solo los módulos cuyo permiso tiene el usuario", () => {
    expect(
      labels(getVisibleNavItems({ permissions: ["customers.manage", "reports.view"], isOwner: false })),
    ).toEqual(["Inicio", "Clientes", "Reportes"]);
  });

  it("oculta un módulo deshabilitado en el salón aunque el propietario lo tenga", () => {
    expect(
      labels(getVisibleNavItems({ permissions: [], isOwner: true, disabledFeatures: ["customers"] })),
    ).not.toContain("Clientes");
  });

  it("acepta un permiso de cualquiera de sus alternativas (citas: ver o gestionar)", () => {
    expect(labels(getVisibleNavItems({ permissions: ["appointments.view"], isOwner: false }))).toContain("Citas");
    expect(labels(getVisibleNavItems({ permissions: ["appointments.manage"], isOwner: false }))).toContain("Citas");
    expect(labels(getVisibleNavItems({ permissions: ["appointments.view_all"], isOwner: false }))).not.toContain("Citas");
  });
});

describe("getVisibleNavGroups", () => {
  it("conserva solo los grupos con al menos un ítem visible", () => {
    const groups = getVisibleNavGroups({ permissions: ["reports.view"], isOwner: false });

    expect(groups.map((group) => group.label)).toEqual([undefined, "Administración"]);
    expect(labels(groups[1]?.items ?? [])).toEqual(["Reportes"]);
  });

  it("un propietario recibe los cinco grupos completos con sus etiquetas", () => {
    const groups = getVisibleNavGroups({ permissions: [], isOwner: true });

    expect(groups.map((group) => group.label)).toEqual([undefined, "Agenda", "Gestión", "Administración"]);
    expect(groups.reduce((total, group) => total + group.items.length, 0)).toBe(13);
  });

  it("descarta por completo un grupo cuyos módulos están deshabilitados", () => {
    const groups = getVisibleNavGroups({
      permissions: [],
      isOwner: true,
      disabledFeatures: ["appointments", "recordatorios", "customers", "employees", "services", "retail", "inventory", "reports", "expenses", "roles", "plantillas", "salon"],
    });

    expect(groups.map((group) => group.label)).toEqual([undefined]);
  });

  it("los grupos son serializables (sin componentes de icono)", () => {
    const groups = getVisibleNavGroups({ permissions: [], isOwner: true });

    expect(JSON.parse(JSON.stringify(groups))).toEqual(groups);
  });
});
