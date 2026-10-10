import { describe, expect, it } from "vitest";
import { isEligible } from "./eligibility";

const SERVICE = { id: "svc-1", category_id: "cat-1" };

describe("isEligible", () => {
  it("es elegible cuando el servicio y su categoría están entre los del profesional", () => {
    expect(isEligible({ service_ids: ["svc-1"], category_ids: ["cat-1"] }, SERVICE)).toBe(true);
  });

  it("no es elegible si el servicio no figura entre los del profesional", () => {
    expect(isEligible({ service_ids: ["svc-2"], category_ids: ["cat-1"] }, SERVICE)).toBe(false);
  });

  it("no es elegible si el servicio existe pero la categoría no está entre las atendidas", () => {
    expect(isEligible({ service_ids: ["svc-1"], category_ids: ["cat-2"] }, SERVICE)).toBe(false);
  });

  it("no es elegible sin servicios ni categorías asignadas", () => {
    expect(isEligible({ service_ids: [], category_ids: [] }, SERVICE)).toBe(false);
  });
});
