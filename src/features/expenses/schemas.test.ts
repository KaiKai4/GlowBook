import { describe, expect, it } from "vitest";
import { CreateExpenseSchema, EXPENSE_CATEGORIES } from "./schemas";

const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000c1";

const validExpense = {
  expense_date: "2026-06-10",
  amount: "25.5",
  category: "utilities",
  idempotency_key: IDEMPOTENCY_KEY,
};

describe("CreateExpenseSchema", () => {
  it("convierte el monto de texto a número y aplica defaults de texto", () => {
    expect(CreateExpenseSchema.parse(validExpense)).toEqual({
      expense_date: "2026-06-10",
      amount: 25.5,
      category: "utilities",
      concept: "",
      vendor_name: "",
      note: "",
      receipt_url: undefined,
      idempotency_key: IDEMPOTENCY_KEY,
    });
  });

  it("exige una clave de idempotencia uuid", () => {
    expect(CreateExpenseSchema.safeParse({ ...validExpense, idempotency_key: "" }).success).toBe(false);
    expect(CreateExpenseSchema.safeParse({ ...validExpense, idempotency_key: undefined }).success).toBe(false);
  });

  it("usa 'other' como categoría por defecto y exige concepto en ese caso", () => {
    const result = CreateExpenseSchema.safeParse({ ...validExpense, category: undefined });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["concept"]);
    expect(result.error?.issues[0]?.message).toBe("Describe el concepto del gasto.");
  });

  it("exige concepto solo cuando la categoría es 'other', también si viene con espacios", () => {
    expect(CreateExpenseSchema.safeParse({ ...validExpense, concept: "" }).success).toBe(true);
    expect(
      CreateExpenseSchema.safeParse({ ...validExpense, category: "other", concept: "   " }).success
    ).toBe(false);
    expect(
      CreateExpenseSchema.safeParse({ ...validExpense, category: "other", concept: "Regalos" }).success
    ).toBe(true);
  });

  it("exige monto estrictamente positivo", () => {
    expect(CreateExpenseSchema.safeParse({ ...validExpense, amount: 0 }).error?.issues[0]?.message).toBe(
      "El monto debe ser mayor que 0."
    );
    expect(CreateExpenseSchema.safeParse({ ...validExpense, amount: "-3" }).success).toBe(false);
  });

  it("exige fecha y categoría dentro del catálogo", () => {
    expect(CreateExpenseSchema.safeParse({ ...validExpense, expense_date: "" }).error?.issues[0]?.message).toBe(
      "La fecha es obligatoria."
    );
    expect(CreateExpenseSchema.safeParse({ ...validExpense, category: "casino" }).success).toBe(false);
    for (const category of EXPENSE_CATEGORIES) {
      if (category === "other") continue;
      expect(CreateExpenseSchema.safeParse({ ...validExpense, category }).success).toBe(true);
    }
  });

  it("acepta comprobante como enlace https o cadena vacia, y rechaza texto que no es enlace", () => {
    expect(
      CreateExpenseSchema.safeParse({ ...validExpense, receipt_url: "https://files.example/factura.pdf" }).success
    ).toBe(true);
    expect(CreateExpenseSchema.safeParse({ ...validExpense, receipt_url: "" }).success).toBe(true);

    const invalid = CreateExpenseSchema.safeParse({ ...validExpense, receipt_url: "factura.pdf" });
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues[0]?.message).toBe("Enlace de comprobante inválido.");
  });

  it("recorta los textos libres y limita sus longitudes", () => {
    const parsed = CreateExpenseSchema.parse({
      ...validExpense,
      vendor_name: "  Proveedor  ",
      note: "  nota ",
    });

    expect(parsed).toMatchObject({ vendor_name: "Proveedor", note: "nota" });
    expect(CreateExpenseSchema.safeParse({ ...validExpense, vendor_name: "v".repeat(121) }).success).toBe(false);
    expect(CreateExpenseSchema.safeParse({ ...validExpense, note: "n".repeat(501) }).success).toBe(false);
  });

  it("solo acepta comprobantes https y rechaza http y otros esquemas", () => {
    const http = CreateExpenseSchema.safeParse({ ...validExpense, receipt_url: "http://example.com/f.pdf" });
    expect(http.success).toBe(false);
    expect(http.error?.issues[0]?.message).toBe("La URL del comprobante debe empezar por https://");

    const script = CreateExpenseSchema.safeParse({ ...validExpense, receipt_url: "javascript:alert(1)" });
    expect(script.success).toBe(false);

    expect(
      CreateExpenseSchema.safeParse({ ...validExpense, receipt_url: "https://example.com/f.pdf" }).success
    ).toBe(true);
  });
});
