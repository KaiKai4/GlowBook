import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  argsOf,
  createBillingSupabaseFake,
  firstQueryOn,
  type BillingSupabaseFake,
} from "@/test/billing-feature-supabase";
import { countPlanAssignments } from "./commercial-plans.repo";
import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
const ADMIN_PROOF = issuePlatformAdminProof("admin-1");

// Conteo de asignaciones de salon a un plan (cualquier estado). Lo usa el
// caso de uso para impedir borrar planes con salones asignados.

const admin = vi.hoisted(() => ({ factory: vi.fn() }));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: admin.factory,
}));

function useFake(fake: BillingSupabaseFake) {
  admin.factory.mockReturnValue(fake);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("countPlanAssignments", () => {
  it("devuelve el conteo exacto de asignaciones del plan pedido", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_assignments: { data: null, count: 3, error: null } },
    });
    useFake(fake);

    await expect(countPlanAssignments(ADMIN_PROOF, "plan-1")).resolves.toBe(3);

    const query = firstQueryOn(fake, "salon_plan_assignments");
    expect(argsOf(query, "select")).toEqual(["id", { count: "exact", head: true }]);
    expect(argsOf(query, "eq")).toEqual(["plan_id", "plan-1"]);
  });

  it("devuelve 0 cuando la consulta no informa conteo", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_assignments: { data: null, count: null, error: null } },
    });
    useFake(fake);

    await expect(countPlanAssignments(ADMIN_PROOF, "plan-1")).resolves.toBe(0);
  });

  it("lanza el mensaje de error de la base de datos", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        salon_plan_assignments: { data: null, count: null, error: { message: "fallo de conteo" } },
      },
    });
    useFake(fake);

    await expect(countPlanAssignments(ADMIN_PROOF, "plan-1")).rejects.toThrow("fallo de conteo");
  });
});
