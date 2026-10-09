import { describe, expect, it } from "vitest";
import { inventoryPurchaseFields } from "./inventory-purchase-fields";

function formOf(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe("inventoryPurchaseFields", () => {
  it("usa commerce_name como proveedor cuando supplier_name no llega o viene vacío", () => {
    expect(inventoryPurchaseFields(formOf({ commerce_name: "Proveedor X" }))).toMatchObject({
      supplier_name: "Proveedor X",
    });
    expect(
      inventoryPurchaseFields(formOf({ supplier_name: "", commerce_name: "Proveedor X" }))
    ).toMatchObject({ supplier_name: "Proveedor X" });
  });

  it("prefiere supplier_name cuando viene informado", () => {
    expect(
      inventoryPurchaseFields(formOf({ supplier_name: "Distribuidora Sol", commerce_name: "Proveedor X" }))
    ).toMatchObject({ supplier_name: "Distribuidora Sol" });
  });

  it("deja el proveedor vacío si no llega ninguno de los dos y fija la ubicación en storage", () => {
    expect(inventoryPurchaseFields(formOf({ quantity: "2" }))).toEqual({
      quantity: "2",
      supplier_name: "",
      location: "storage",
    });
  });
});
