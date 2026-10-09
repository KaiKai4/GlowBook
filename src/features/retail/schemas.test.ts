import { describe, expect, it } from "vitest";
import { RetailSaleSchema } from "./schemas";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000033";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000044";

const validSale = {
  product_id: PRODUCT_ID,
  quantity: "2",
  unit_price: "12.5",
};

describe("RetailSaleSchema", () => {
  it("convierte cantidades y precios de formulario y aplica defaults de ubicacion, pago y nota", () => {
    expect(RetailSaleSchema.parse(validSale)).toEqual({
      customer_id: "",
      product_id: PRODUCT_ID,
      location: "retail",
      quantity: 2,
      unit_price: 12.5,
      payment_method: "cash",
      note: "",
    });
  });

  it("acepta cliente opcional con uuid o cadena vacia y rechaza otros textos", () => {
    expect(RetailSaleSchema.parse({ ...validSale, customer_id: CUSTOMER_ID }).customer_id).toBe(CUSTOMER_ID);
    expect(RetailSaleSchema.parse({ ...validSale, customer_id: "" }).customer_id).toBe("");
    expect(RetailSaleSchema.safeParse({ ...validSale, customer_id: "no-uuid" }).success).toBe(false);
  });

  it("exige cantidad entera y positiva", () => {
    expect(RetailSaleSchema.safeParse({ ...validSale, quantity: "1.5" }).error?.issues[0]?.message).toBe(
      "La cantidad debe ser un numero entero."
    );
    expect(RetailSaleSchema.safeParse({ ...validSale, quantity: "0" }).error?.issues[0]?.message).toBe(
      "La cantidad debe ser mayor que 0."
    );
  });

  it("no permite precios negativos y acepta precio cero", () => {
    expect(RetailSaleSchema.safeParse({ ...validSale, unit_price: 0 }).success).toBe(true);
    expect(RetailSaleSchema.safeParse({ ...validSale, unit_price: -0.01 }).error?.issues[0]?.message).toBe(
      "El precio no puede ser negativo."
    );
  });

  it("normaliza el metodo de pago recortando y colapsando espacios", () => {
    expect(RetailSaleSchema.parse({ ...validSale, payment_method: "  Tarjeta   Debito " }).payment_method).toBe(
      "Tarjeta Debito"
    );
  });

  it("rechaza metodos de pago vacios o demasiado largos", () => {
    expect(RetailSaleSchema.safeParse({ ...validSale, payment_method: "   " }).error?.issues[0]?.message).toBe(
      "El metodo de pago es obligatorio."
    );
    expect(RetailSaleSchema.safeParse({ ...validSale, payment_method: "m".repeat(65) }).error?.issues[0]?.message).toBe(
      "El metodo de pago no puede superar 64 caracteres."
    );
  });

  it("valida ubicacion de inventario y producto", () => {
    expect(RetailSaleSchema.safeParse({ ...validSale, location: "storage" }).success).toBe(true);
    expect(RetailSaleSchema.safeParse({ ...validSale, location: "bodega" }).success).toBe(false);
    expect(RetailSaleSchema.safeParse({ ...validSale, product_id: "x" }).error?.issues[0]?.message).toBe(
      "Producto inválido."
    );
  });
});
