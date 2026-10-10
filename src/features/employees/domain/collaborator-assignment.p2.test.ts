import { describe, expect, it } from "vitest";
import type { ServiceCategoryRef } from "./collaborator-assignment";
import { PublicError } from "@/infra/public-error";
import { assertCollaboratorAssignments } from "./collaborator-assignment";

function assertServicesHaveAssignedCategories(services: ServiceCategoryRef[], categoryIds: string[]): void {
  assertCollaboratorAssignments({
    requestedServiceIds: services.map((service) => service.id),
    requestedCategoryIds: categoryIds,
    activeCategoryIds: categoryIds,
    services,
  });
}

describe("asignacion de servicios a colaboradores: categorías", () => {
  it("permite asignar servicios cuyas categorías están asignadas al colaborador", () => {
    const services = [
      { id: "s1", category_id: "c1" },
      { id: "s2", category_id: "c2" },
    ];

    expect(() => assertServicesHaveAssignedCategories(services, ["c1", "c2"])).not.toThrow();
  });

  it("sin servicios no hay nada que validar", () => {
    expect(() => assertServicesHaveAssignedCategories([], [])).not.toThrow();
  });

  it("un servicio cuya categoría no está asignada al colaborador lanza PublicError", () => {
    const services = [
      { id: "s1", category_id: "c1" },
      { id: "s2", category_id: "c2" },
    ];

    const attempt = () => assertServicesHaveAssignedCategories(services, ["c1"]);

    expect(attempt).toThrow(PublicError);
    expect(attempt).toThrow("Para asignar un servicio al colaborador, también debes asignar su categoría.");
  });
});
