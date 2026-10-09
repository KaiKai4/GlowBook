import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabaseFrom, type FakeQueryResult } from "@/test/supabase-query-fake";
import { findSubscriptionRows } from "./salon-subscriptions.repo";

// Mapeo de overrides de plan: columnas snake_case y precio numérico como texto
// deben llegar al dominio como número o null.

const adminClient = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => adminClient.current }));

function useTables(tables: Record<string, FakeQueryResult>) {
  adminClient.current = fakeSupabaseFrom(tables);
}

const SALON_ID = "00000000-0000-4000-8000-0000000000d1";

function overrideRow(id: string, priceOverride: number | string | null) {
  return {
    id,
    salon_id: SALON_ID,
    module_key: "reports",
    metric_key: null,
    module_enabled: true,
    max_delta: null,
    max_override: null,
    enforcement_mode: null,
    warning_threshold: null,
    reason: "Cortesía comercial",
    starts_at: null,
    ends_at: null,
    status: "active",
    addon_id: null,
    quantity: 1,
    is_gift: true,
    price_override: priceOverride,
  };
}

describe("findSubscriptionRows: mapeo de overrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminClient.current = null;
  });

  it("convierte el precio especial de texto a número y conserva el precio nulo", async () => {
    useTables({
      salon_plan_overrides: {
        data: [overrideRow("ov-1", "15.50"), overrideRow("ov-2", null)],
        error: null,
      },
    });

    const result = await findSubscriptionRows();

    expect(result.overrides).toEqual([
      expect.objectContaining({ id: "ov-1", salonId: SALON_ID, priceOverride: 15.5, isGift: true }),
      expect.objectContaining({ id: "ov-2", priceOverride: null }),
    ]);
  });

  it("devuelve listas vacías cuando no hay asignaciones, overrides ni alertas", async () => {
    useTables({});

    expect(await findSubscriptionRows()).toEqual({ assignments: [], overrides: [], alerts: [] });
  });
});
