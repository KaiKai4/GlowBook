import { describe, expect, it } from "vitest";

import { plan } from "@/test/billing-plan-fixtures";
import { buildSubscriptionRow, subscriptionMrr, type SalonSubscriptionRow } from "./salon-subscription-rows";

const salon = { id: "salon-1", name: "Salon Uno", is_active: true };

describe("buildSubscriptionRow", () => {
  it("cobra el plan y los extras cuando la asignación está activa", () => {
    const row = buildSubscriptionRow({
      salon,
      assignment: { status: "active", trial_ends_at: null },
      plan: plan({ monthlyPrice: 20, currency: "USD" }),
      extras: [{ monthlyPrice: 5.555 }, { monthlyPrice: 4.444 }],
      openAlertCount: 2,
    });
    expect(row).toEqual({
      salonId: "salon-1",
      salonName: "Salon Uno",
      salonIsActive: true,
      planId: "plan-basic",
      planName: "Basico",
      planPrice: 20,
      currency: "USD",
      status: "active",
      trialEndsAt: null,
      extrasCount: 2,
      extrasPrice: 10,
      monthlyTotal: 30,
      openAlertCount: 2,
    });
  });

  it("no cobra el plan cuando la asignación está pausada, pero sí los extras", () => {
    const row = buildSubscriptionRow({
      salon,
      assignment: { status: "paused", trial_ends_at: "2026-05-01" },
      plan: plan({ monthlyPrice: 20 }),
      extras: [{ monthlyPrice: 3 }],
      openAlertCount: 0,
    });
    expect(row.planPrice).toBe(0);
    expect(row.trialEndsAt).toBe("2026-05-01");
    expect(row.monthlyTotal).toBe(3);
  });

  it("sin asignación ni plan usa valores neutros", () => {
    const row = buildSubscriptionRow({ salon, assignment: null, plan: null, extras: [], openAlertCount: 0 });
    expect(row.planId).toBeNull();
    expect(row.planName).toBeNull();
    expect(row.status).toBeNull();
    expect(row.currency).toBe("USD");
    expect(row.monthlyTotal).toBe(0);
  });
});

describe("subscriptionMrr", () => {
  const base: SalonSubscriptionRow = {
    salonId: "s",
    salonName: "s",
    salonIsActive: true,
    planId: "p",
    planName: "p",
    planPrice: 0,
    currency: "USD",
    status: "active",
    trialEndsAt: null,
    extrasCount: 0,
    extrasPrice: 0,
    monthlyTotal: 0,
    openAlertCount: 0,
  };

  it("suma solo las filas con asignación activa y redondea", () => {
    const rows = [
      { ...base, monthlyTotal: 10.1 },
      { ...base, monthlyTotal: 20.2 },
      { ...base, status: "trialing" as const, monthlyTotal: 99 },
      { ...base, status: null, monthlyTotal: 99 },
    ];
    expect(subscriptionMrr(rows)).toBe(30.3);
  });

  it("sin filas activas el MRR es cero", () => {
    expect(subscriptionMrr([])).toBe(0);
  });
});
