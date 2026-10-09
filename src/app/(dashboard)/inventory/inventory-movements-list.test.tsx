// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { InventoryPageView } from "@/features/inventory/use-cases/inventory-products";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { InventoryMovementsList } from "./inventory-movements-list";

type Movement = InventoryPageView["recentMovements"][number];

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: "mov-1",
    productName: "Shampoo",
    location: "storage",
    movementType: "purchase",
    quantityDelta: 3,
    quantityAfter: 10,
    note: "",
    createdAt: "2026-05-25T15:00:00.000Z",
    ...overrides,
  };
}

describe("InventoryMovementsList", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("indica que no hay movimientos cuando la lista está vacía", () => {
    mounted = mountComponent(<InventoryMovementsList movements={[]} />);

    expect(mounted.container.textContent).toContain("Sin movimientos todavia.");
  });

  it("muestra 'Sin nota' cuando el movimiento no tiene nota y firma las entradas", () => {
    mounted = mountComponent(<InventoryMovementsList movements={[movement({ note: "" })]} />);

    expect(mounted.container.textContent).toContain("Shampoo");
    expect(mounted.container.textContent).toContain("Sin nota");
    expect(mounted.container.textContent).toContain("+3");
  });

  it("muestra la nota real y las salidas sin signo positivo", () => {
    mounted = mountComponent(
      <InventoryMovementsList movements={[movement({ note: "Ajuste mensual", quantityDelta: -2 })]} />
    );

    expect(mounted.container.textContent).toContain("Ajuste mensual");
    expect(mounted.container.textContent).toContain("-2");
    expect(mounted.container.textContent).not.toContain("Sin nota");
    expect(mounted.container.querySelector(".text-danger")?.textContent).toBe("-2");
  });
});
