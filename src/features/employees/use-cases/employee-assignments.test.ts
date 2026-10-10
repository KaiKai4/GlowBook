import { beforeEach, describe, expect, it, vi } from "vitest";
import { findActiveAssignmentReferences } from "@/features/employees/data/employees.repo";
import { PublicError } from "@/infra/public-error";
import { validateEmployeeAssignments } from "./employee-assignments";

vi.mock("@/features/employees/data/employees.repo", () => ({
  findActiveAssignmentReferences: vi.fn(),
}));

const SALON_ID = "salon-1";
const CAT_A = "11111111-1111-4111-8111-111111111111";
const CAT_B = "22222222-2222-4222-8222-222222222222";
const SVC_1 = "33333333-3333-4333-8333-333333333333";
const SVC_2 = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateEmployeeAssignments", () => {
  it("no consulta la BD cuando no hay asignaciones", async () => {
    await validateEmployeeAssignments(SALON_ID, [], []);

    expect(findActiveAssignmentReferences).not.toHaveBeenCalled();
  });

  it("deduplica los ids antes de consultar", async () => {
    vi.mocked(findActiveAssignmentReferences).mockResolvedValue({
      activeCategoryIds: [CAT_A],
      services: [{ id: SVC_1, category_id: CAT_A }],
    });

    await validateEmployeeAssignments(SALON_ID, [SVC_1, SVC_1], [CAT_A, CAT_A]);

    expect(findActiveAssignmentReferences).toHaveBeenCalledWith(SALON_ID, [SVC_1], [CAT_A]);
  });

  it("acepta servicios cuya categoría también está asignada", async () => {
    vi.mocked(findActiveAssignmentReferences).mockResolvedValue({
      activeCategoryIds: [CAT_A],
      services: [{ id: SVC_1, category_id: CAT_A }],
    });

    await expect(validateEmployeeAssignments(SALON_ID, [SVC_1], [CAT_A])).resolves.toBeUndefined();
  });

  it("rechaza categorías que no pertenecen al salón o están inactivas", async () => {
    vi.mocked(findActiveAssignmentReferences).mockResolvedValue({ activeCategoryIds: [CAT_A], services: [] });

    await expect(validateEmployeeAssignments(SALON_ID, [], [CAT_A, CAT_B])).rejects.toThrow(
      "Una o más categorías no pertenecen al salón o están inactivas."
    );
  });

  it("rechaza servicios que no pertenecen al salón o están inactivos", async () => {
    vi.mocked(findActiveAssignmentReferences).mockResolvedValue({
      activeCategoryIds: [CAT_A],
      services: [{ id: SVC_1, category_id: CAT_A }],
    });

    await expect(validateEmployeeAssignments(SALON_ID, [SVC_1, SVC_2], [CAT_A])).rejects.toThrow(
      "Uno o más servicios no pertenecen al salón o están inactivos."
    );
  });

  it("rechaza un servicio cuya categoría no fue asignada, con error publico", async () => {
    vi.mocked(findActiveAssignmentReferences).mockResolvedValue({
      activeCategoryIds: [CAT_A],
      services: [{ id: SVC_1, category_id: CAT_B }],
    });

    const attempt = validateEmployeeAssignments(SALON_ID, [SVC_1], [CAT_A]);

    await expect(attempt).rejects.toBeInstanceOf(PublicError);
    await expect(attempt).rejects.toThrow("Para asignar un servicio al colaborador, también debes asignar su categoría.");
  });

  it("rechaza servicios sin categorías asignadas", async () => {
    vi.mocked(findActiveAssignmentReferences).mockResolvedValue({
      activeCategoryIds: [],
      services: [{ id: SVC_1, category_id: CAT_A }],
    });

    await expect(validateEmployeeAssignments(SALON_ID, [SVC_1], [])).rejects.toThrow(
      "Para asignar un servicio al colaborador, también debes asignar su categoría."
    );
  });
});
