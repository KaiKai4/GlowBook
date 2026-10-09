import { describe, expect, it } from "vitest";
import { getVisibleNavGroups, getVisibleNavItems } from "./nav-items";

const labels = (items: Array<{ label: string }>) => items.map((item) => item.label);

describe("getVisibleNavItems", () => {
  it("el propietario ve todas las secciones y el inicio siempre es visible", () => {
    const visible = labels(getVisibleNavItems([], true));

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
    expect(labels(getVisibleNavItems([], false))).toEqual(["Inicio"]);
  });

  it("muestra solo los módulos cuyo permiso tiene el usuario", () => {
    expect(labels(getVisibleNavItems(["customers.manage", "reports.view"], false))).toEqual([
      "Inicio",
      "Clientes",
      "Reportes",
    ]);
  });

  it("oculta un módulo deshabilitado en el salón aunque el propietario lo tenga", () => {
    expect(labels(getVisibleNavItems([], true, ["customers"]))).not.toContain("Clientes");
  });

  it("acepta un permiso de cualquiera de sus alternativas (citas: ver o gestionar)", () => {
    expect(labels(getVisibleNavItems(["appointments.view"], false))).toContain("Citas");
    expect(labels(getVisibleNavItems(["appointments.manage"], false))).toContain("Citas");
    expect(labels(getVisibleNavItems(["appointments.view_all"], false))).not.toContain("Citas");
  });
});

describe("getVisibleNavGroups", () => {
  it("conserva solo los grupos con al menos un ítem visible", () => {
    const groups = getVisibleNavGroups(["reports.view"], false);

    expect(groups.map((group) => group.label)).toEqual([undefined, "Administración"]);
    expect(labels(groups[1]?.items ?? [])).toEqual(["Reportes"]);
  });

  it("un propietario recibe los cinco grupos completos con sus etiquetas", () => {
    const groups = getVisibleNavGroups([], true);

    expect(groups.map((group) => group.label)).toEqual([undefined, "Agenda", "Gestión", "Administración"]);
    expect(groups.reduce((total, group) => total + group.items.length, 0)).toBe(13);
  });

  it("descarta por completo un grupo cuyos módulos están deshabilitados", () => {
    const groups = getVisibleNavGroups([], true, ["appointments", "recordatorios", "customers", "employees", "services", "retail", "inventory", "reports", "expenses", "roles", "plantillas", "salon"]);

    expect(groups.map((group) => group.label)).toEqual([undefined]);
  });
});
