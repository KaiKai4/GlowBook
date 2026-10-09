import { describe, expect, it } from "vitest";
import { isHttpsReceiptUrl } from "./receipt-url";

describe("isHttpsReceiptUrl", () => {
  it("acepta solo URLs con esquema https", () => {
    expect(isHttpsReceiptUrl("https://example.com/factura.pdf")).toBe(true);
    expect(isHttpsReceiptUrl("HTTPS://example.com/factura.pdf")).toBe(true);
    expect(isHttpsReceiptUrl("http://example.com/factura.pdf")).toBe(false);
    expect(isHttpsReceiptUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsReceiptUrl("data:text/html,hola")).toBe(false);
  });

  it("rechaza valores vacios o ausentes", () => {
    expect(isHttpsReceiptUrl(null)).toBe(false);
    expect(isHttpsReceiptUrl(undefined)).toBe(false);
    expect(isHttpsReceiptUrl("")).toBe(false);
  });
});
