import { describe, expect, it } from "vitest";
import {
  assertServicesHaveAssignedCategories,
  findServicesMissingAssignedCategory,
} from "./collaborator-assignment";

const services = [
  { id: "cut", category_id: "hair" },
  { id: "manicure", category_id: "nails" },
];

describe("collaborator assignment", () => {
  it("allows services when their categories are assigned", () => {
    expect(() =>
      assertServicesHaveAssignedCategories(services, ["hair", "nails"])
    ).not.toThrow();
  });

  it("detects services whose category is not assigned to the collaborator", () => {
    expect(findServicesMissingAssignedCategory(services, ["hair"])).toEqual([
      { id: "manicure", category_id: "nails" },
    ]);
  });

  it("rejects assigning a service without assigning its category", () => {
    expect(() => assertServicesHaveAssignedCategories(services, ["hair"])).toThrow(
      "tambien debes asignar su categoria"
    );
  });
});
