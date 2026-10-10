// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCurrency } from "@/infra/format/money";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { click } from "@/test/ui-people-dom";
import { buildService } from "@/test/ui-people-fixtures";
import { ServiceCard } from "./service-card";

const EMPLOYEES = [1, 2, 3, 4, 5, 6, 7].map((index) => ({
  id: `emp-${index}`,
  initials: `E${index}`,
  name: `Empleado ${index}`,
}));

describe("ServiceCard", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra nombre, descripción, duración, precio formateado y estado activo", () => {
    mounted = mountComponent(
      <ServiceCard service={buildService({ price: 15, duration_minutes: 45 })} pricingMode="fixed" onEdit={vi.fn()} />
    );

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Corte de cabello");
    expect(text).toContain("Corte clásico con lavado");
    expect(text).toContain("45 min");
    expect(text).toContain(formatCurrency(15));
    expect(text).toContain("Activo");
    expect(text).not.toContain("Variable al cobrar");
  });

  it("omite la descripción cuando el servicio no tiene", () => {
    mounted = mountComponent(
      <ServiceCard service={buildService({ description: null })} pricingMode="fixed" onEdit={vi.fn()} />
    );

    expect(mounted.container.querySelector("p.line-clamp-2")).toBeNull();
  });

  it("indica un servicio inactivo y el aviso de precio variable en categorías variables", () => {
    mounted = mountComponent(
      <ServiceCard service={buildService({ is_active: false })} pricingMode="variable" onEdit={vi.fn()} />
    );

    expect(mounted.container.textContent).toContain("Inactivo");
    expect(mounted.container.textContent).toContain("Variable al cobrar");
  });

  it("invoca onEdit desde el botón accesible de edición del servicio", () => {
    const onEdit = vi.fn();
    mounted = mountComponent(<ServiceCard service={buildService()} pricingMode="fixed" onEdit={onEdit} />);

    const edit = mounted.container.querySelector<HTMLButtonElement>('button[aria-label="Editar Corte de cabello"]');
    expect(edit?.title).toBe("Editar servicio");
    if (!edit) throw new Error("falta el botón de editar");
    click(edit);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("muestra las iniciales de los empleados asignados con su nombre accesible", () => {
    mounted = mountComponent(
      <ServiceCard service={buildService({ employees: EMPLOYEES.slice(0, 3) })} pricingMode="fixed" onEdit={vi.fn()} />
    );

    const badges = Array.from(mounted.container.querySelectorAll<HTMLSpanElement>("span[title]"));
    expect(badges.map((badge) => badge.textContent)).toEqual(["E1", "E2", "E3"]);
    expect(badges[0]?.title).toBe("Empleado 1");
    expect(mounted.container.textContent).not.toContain("+");
  });

  it("resume los empleados que exceden cinco con un contador", () => {
    mounted = mountComponent(
      <ServiceCard service={buildService({ employees: EMPLOYEES })} pricingMode="fixed" onEdit={vi.fn()} />
    );

    const badges = Array.from(mounted.container.querySelectorAll<HTMLSpanElement>("span[title]"));
    expect(badges).toHaveLength(5);
    expect(mounted.container.textContent).toContain("+2");
  });

  it("no renderiza la fila de empleados cuando el servicio no tiene asignados", () => {
    mounted = mountComponent(
      <ServiceCard service={buildService({ employees: [] })} pricingMode="fixed" onEdit={vi.fn()} />
    );

    expect(mounted.container.querySelector("span[title]")).toBeNull();
  });
});
