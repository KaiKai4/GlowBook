import { describe, expect, it } from "vitest";
import { canTransferToLocation } from "./transfer-rules";

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
