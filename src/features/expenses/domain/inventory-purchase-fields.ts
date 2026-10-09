// Campos de un formulario de compra de inventario antes de validarlos (sin I/O).

/**
 * Un formulario de compra llega con `commerce_name` o `supplier_name`: el
 * proveedor usa `supplier_name` y, si falta, cae a `commerce_name`. Toda compra
 * desde gastos entra a bodega.
 */
export function inventoryPurchaseFields(formData: FormData): Record<string, unknown> {
  return {
    ...Object.fromEntries(formData),
    supplier_name: formData.get("supplier_name") || formData.get("commerce_name") || "",
    location: "storage",
  };
}
