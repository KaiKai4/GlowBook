import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG } from "../domain/permissions";
import { hasOnlyKnownPermissionKeys, uniquePermissionKeys } from "./permissions";

describe("PERMISSION_CATALOG", () => {
  it("lists each permission key once", () => {
    const keys = PERMISSION_CATALOG.map((permission) => permission.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("hasOnlyKnownPermissionKeys", () => {
  it("accepts every key from the catalog", () => {
    const allKeys = PERMISSION_CATALOG.map((permission) => permission.key);

    expect(hasOnlyKnownPermissionKeys(allKeys)).toBe(true);
  });

  it("accepts an empty selection", () => {
    expect(hasOnlyKnownPermissionKeys([])).toBe(true);
  });

  it("rejects the whole selection when a single key is unknown", () => {
    expect(hasOnlyKnownPermissionKeys(["reports.view", "reports.export"])).toBe(false);
  });

  it("is case sensitive", () => {
    expect(hasOnlyKnownPermissionKeys(["Reports.View"])).toBe(false);
  });
});

describe("uniquePermissionKeys", () => {
  it("removes duplicates while keeping first-seen order", () => {
    expect(uniquePermissionKeys(["roles.manage", "reports.view", "roles.manage"])).toEqual([
      "roles.manage",
      "reports.view",
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(uniquePermissionKeys([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = ["a", "a"];
    uniquePermissionKeys(input);

    expect(input).toEqual(["a", "a"]);
  });
});
