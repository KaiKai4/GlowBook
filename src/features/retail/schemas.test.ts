import { describe, expect, it } from "vitest";
import { RetailSaleSchema } from "./schemas";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000033";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000044";
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000c1";

const validSale = {
  product_id: PRODUCT_ID,
  quantity: "2",
  unit_price: "12.5",
  idempotency_key: IDEMPOTENCY_KEY,
};

describe("RetailSaleSchema", () => {
  it("convierte cantidades y precios de formulario y aplica defaults de ubicación, pago y nota", () => {
    expect(RetailSaleSchema.parse(validSale)).toEqual({
      customer_id: "",
      product_id: PRODUCT_ID,
      location: "retail",
      quantity: 2,
      unit_price: 12.5,
      payment_method: "cash",
      note: "",
      idempotency_key: IDEMPOTENCY_KEY,
    });
  });

  it("exige una clave de idempotencia uuid", () => {
    expect(RetailSaleSchema.safeParse({ ...validSale, idempotency_key: undefined }).success).toBe(false);
    expect(RetailSaleSchema.safeParse({ ...validSale, idempotency_key: "no-uuid" }).success).toBe(false);
  });

  it("acepta cliente opcional con uuid o cadena vacia y rechaza otros textos", () => {
    expect(RetailSaleSchema.parse({ ...validSale, customer_id: CUSTOMER_ID }).customer_id).toBe(CUSTOMER_ID);
    expect(RetailSaleSchema.parse({ ...validSale, customer_id: "" }).customer_id).toBe("");
    expect(RetailSaleSchema.safeParse({ ...validSale, customer_id: "no-uuid" }).success).toBe(false);
  });

  it("exige cantidad entera y positiva", () => {
    expect(RetailSaleSchema.safeParse({ ...validSale, quantity: "1.5" }).error?.issues[0]?.message).toBe(
      "La cantidad debe ser un número entero."
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

  it("normaliza el método de pago recortando y colapsando espacios", () => {
    expect(RetailSaleSchema.parse({ ...validSale, payment_method: "  Tarjeta   Debito " }).payment_method).toBe(
      "Tarjeta Debito"
    );
  });

  it("rechaza métodos de pago vacios o demasiado largos", () => {
    expect(RetailSaleSchema.safeParse({ ...validSale, payment_method: "   " }).error?.issues[0]?.message).toBe(
      "El método de pago es obligatorio."
    );
    expect(RetailSaleSchema.safeParse({ ...validSale, payment_method: "m".repeat(65) }).error?.issues[0]?.message).toBe(
      "El método de pago no puede superar 64 caracteres."
    );
  });

  it("válida ubicación de inventario y producto", () => {
    expect(RetailSaleSchema.safeParse({ ...validSale, location: "storage" }).success).toBe(true);
    expect(RetailSaleSchema.safeParse({ ...validSale, location: "bodega" }).success).toBe(false);
    expect(RetailSaleSchema.safeParse({ ...validSale, product_id: "x" }).error?.issues[0]?.message).toBe(
      "Producto inválido."
    );
  });
});
