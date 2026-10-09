import { describe, expect, it } from "vitest";
import { PublicError } from "@/lib/public-error";
import { assertServicesHaveAssignedCategories } from "./collaborator-assignment";

describe("asignacion de servicios a colaboradores: categorias", () => {
  it("permite asignar servicios cuyas categorias estan asignadas al colaborador", () => {
    const services = [
      { id: "s1", category_id: "c1" },
      { id: "s2", category_id: "c2" },
    ];

    expect(() => assertServicesHaveAssignedCategories(services, ["c1", "c2"])).not.toThrow();
  });

  it("sin servicios no hay nada que validar", () => {
    expect(() => assertServicesHaveAssignedCategories([], [])).not.toThrow();
  });

  it("un servicio cuya categoria no esta asignada al colaborador lanza PublicError", () => {
    const services = [
      { id: "s1", category_id: "c1" },
      { id: "s2", category_id: "c2" },
    ];

    const attempt = () => assertServicesHaveAssignedCategories(services, ["c1"]);

    expect(attempt).toThrow(PublicError);
    expect(attempt).toThrow("Para asignar un servicio al colaborador, tambien debes asignar su categoria.");
  });
});
