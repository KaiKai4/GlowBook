import { describe, expect, it } from "vitest";

import type { SalonPlanOverride } from "./commercial-plan";
import {
  buildSalonExtras,
  extraMonthlyPrice,
  monthlyExtrasTotal,
  resolveOverrideMax,
  type CommercialAddon,
} from "./salon-extras";

const addon: CommercialAddon = {
  id: "addon-1",
  code: "extra-appointments-1000",
  name: "Bloque de 1,000 citas",
  description: "",
  kind: "limit_boost",
  moduleKey: null,
  metricKey: "appointments.total",
  limitDelta: 1000,
  currency: "USD",
  monthlyPrice: 8,
  status: "active",
  sortOrder: 0,
};

function override(partial: Partial<SalonPlanOverride>): SalonPlanOverride {
  return {
    id: "override-1",
    salonId: "salon-1",
    salonName: "",
    moduleKey: null,
    metricKey: "appointments.total",
    moduleEnabled: null,
    maxDelta: 1000,
    maxOverride: null,
    enforcementMode: null,
    warningThreshold: null,
    reason: "",
    startsAt: null,
    endsAt: null,
    status: "active",
    addonId: "addon-1",
    quantity: 1,
    isGift: false,
    priceOverride: null,
    ...partial,
  };
}

describe("extraMonthlyPrice", () => {
  it("charges catalog price times quantity", () => {
    expect(extraMonthlyPrice(override({ quantity: 2 }), addon)).toBe(16);
  });

  it("is free when the extra is a gift", () => {
    expect(extraMonthlyPrice(override({ quantity: 3, isGift: true }), addon)).toBe(0);
  });

  it("uses the special price when set", () => {
    expect(extraMonthlyPrice(override({ priceOverride: 5.5, quantity: 2 }), addon)).toBe(11);
  });

  it("costs nothing for manual extras without addon", () => {
    expect(extraMonthlyPrice(override({ addonId: null }), null)).toBe(0);
  });
});

describe("monthlyExtrasTotal", () => {
  it("sums only active extras", () => {
    const extras = buildSalonExtras(
      [override({ id: "a" }), override({ id: "b", status: "canceled" })],
      [addon]
    );
    expect(monthlyExtrasTotal(extras)).toBe(8);
  });
});

describe("resolveOverrideMax", () => {
  it("adds delta times quantity to the base limit", () => {
    expect(resolveOverrideMax(300, [override({ quantity: 2 })])).toBe(2300);
  });

  it("keeps unlimited plans unlimited", () => {
    expect(resolveOverrideMax(null, [override({})])).toBeNull();
  });

  it("prefers a fixed max override", () => {
    expect(resolveOverrideMax(300, [override({ maxOverride: 5000 })])).toBe(5000);
  });
});
