import { describe, expect, it } from "vitest";
import { parseUuid } from "./route-id";

describe("parseUuid", () => {
  it("acepta UUID con forma 8-4-4-4-12, incluidos los de seed", () => {
    expect(parseUuid("3f1c2a4e-9b8d-4c7e-8a6f-1234567890ab")).toBe("3f1c2a4e-9b8d-4c7e-8a6f-1234567890ab");
    expect(parseUuid("00000000-0000-0000-0000-000000000001")).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("rechaza texto libre, cadenas vacias y valores no textuales", () => {
    expect(parseUuid("")).toBeNull();
    expect(parseUuid("no-es-un-id")).toBeNull();
    expect(parseUuid("3f1c2a4e-9b8d-4c7e-8a6f-1234567890a")).toBeNull();
    expect(parseUuid("3f1c2a4e-9b8d-4c7e-8a6f-1234567890ab' OR 1=1")).toBeNull();
    expect(parseUuid(undefined)).toBeNull();
    expect(parseUuid(null)).toBeNull();
    expect(parseUuid(42)).toBeNull();
  });
});
