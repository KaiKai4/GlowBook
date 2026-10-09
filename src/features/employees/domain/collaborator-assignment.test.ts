import { describe, expect, it } from "vitest";
import type { ServiceCategoryRef } from "./collaborator-assignment";
import {
  assertCollaboratorAssignments,
} from "./collaborator-assignment";

const services = [
  { id: "cut", category_id: "hair" },
  { id: "manicure", category_id: "nails" },
];

function assertServicesHaveAssignedCategories(services: ServiceCategoryRef[], categoryIds: string[]): void {
  assertCollaboratorAssignments({
    requestedServiceIds: services.map((service) => service.id),
    requestedCategoryIds: categoryIds,
    activeCategoryIds: categoryIds,
    services,
  });
}

describe("collaborator assignment", () => {
  it("allows services when their categories are assigned", () => {
    expect(() =>
      assertServicesHaveAssignedCategories(services, ["hair", "nails"])
    ).not.toThrow();
  });

  it("rejects assigning a service without assigning its category", () => {
    expect(() => assertServicesHaveAssignedCategories(services, ["hair"])).toThrow(
      "tambien debes asignar su categoria"
    );
  });
});
