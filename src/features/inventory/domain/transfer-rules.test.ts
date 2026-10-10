import { describe, expect, it } from "vitest";
import { canTransferToLocation, transferFromStorage } from "./transfer-rules";

describe("transferFromStorage", () => {
  it("fija el origen en bodega aunque llegue otro origen", () => {
    const result = transferFromStorage({ product_id: "p1", from_location: "retail", to_location: "internal" });
    expect(result).toEqual({ product_id: "p1", from_location: "storage", to_location: "internal" });
  });

  it("no altera el resto de campos del traspaso", () => {
    const input = { product_id: "p1", to_location: "retail", quantity: 3 };
    expect(transferFromStorage(input)).toEqual({ ...input, from_location: "storage" });
  });
});

describe("canTransferToLocation", () => {
  it("permite cualquier destino a un producto habilitado para vitrina", () => {
    expect(canTransferToLocation({ isRetailEnabled: true }, "retail")).toBe(true);
    expect(canTransferToLocation({ isRetailEnabled: true }, "internal")).toBe(true);
  });

  it("solo permite uso interno a un producto que no está habilitado para vitrina", () => {
    expect(canTransferToLocation({ isRetailEnabled: false }, "internal")).toBe(true);
    expect(canTransferToLocation({ isRetailEnabled: false }, "retail")).toBe(false);
  });
});
