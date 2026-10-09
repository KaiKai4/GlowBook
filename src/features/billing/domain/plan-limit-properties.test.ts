import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  calculateLimitState,
  checkLimitAction,
  type CommercialLimitMetric,
  type PlanEnforcementMode,
} from "./commercial-plan";
import { extraMonthlyPrice } from "./salon-extras";
import type { SalonPlanOverride } from "./commercial-plan";

const metric: CommercialLimitMetric = {
  key: "appointments_monthly",
  moduleKey: "appointments",
  name: "Citas",
  description: "",
  unit: "citas",
  counterKey: "appointments_total",
  defaultCountScope: "monthly",
  isActive: true,
  isArchived: false,
  sortOrder: 1,
};

const modeArb = fc.constantFrom<PlanEnforcementMode>("none", "warn", "block");
const maxArb = fc.option(fc.integer({ min: 0, max: 500 }), { nil: null });
const usedArb = fc.integer({ min: 0, max: 600 });

describe("plan limit calculations (properties)", () => {
  it("remaining is never negative and equals max minus used when a max exists", () => {
    fc.assert(
      fc.property(maxArb, usedArb, modeArb, (maxValue, used, enforcementMode) => {
        const state = calculateLimitState({
          metric,
          maxValue,
          enforcementMode,
          warningThreshold: 80,
          countScope: "monthly",
          used,
        });

        if (maxValue === null) {
          expect(state.remaining).toBeNull();
        } else {
          expect(state.remaining).toBe(Math.max(0, maxValue - used));
        }
      })
    );
  });

  it("percentage is null for unlimited or zero-max limits and rounded otherwise", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), usedArb, (maxValue, used) => {
        const state = calculateLimitState({
          metric,
          maxValue,
          enforcementMode: "warn",
          warningThreshold: 80,
          countScope: "monthly",
          used,
        });

        expect(state.percentage).toBe(Math.round((used / maxValue) * 100));
      })
    );

    const zeroMax = calculateLimitState({
      metric,
      maxValue: 0,
      enforcementMode: "block",
      warningThreshold: 80,
      countScope: "monthly",
      used: 3,
    });
    expect(zeroMax.percentage).toBeNull();
  });

  it("over_limit or blocked only when usage is above zero and reaches the max", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), usedArb, modeArb, (maxValue, used, mode) => {
        const state = calculateLimitState({
          metric,
          maxValue,
          enforcementMode: mode,
          warningThreshold: 80,
          countScope: "monthly",
          used,
        });
        const isOver = used >= maxValue && used > 0;

        if (!isOver) {
          expect(state.warningLevel).not.toBe("over_limit");
          expect(state.warningLevel).not.toBe("blocked");
        } else if (mode === "block") {
          expect(state.warningLevel).toBe("blocked");
        } else {
          expect(state.warningLevel).toBe("over_limit");
        }
      })
    );
  });

  it("never reports an unlimited limit as near or over the limit", () => {
    fc.assert(
      fc.property(usedArb, modeArb, (used, mode) => {
        const state = calculateLimitState({
          metric,
          maxValue: null,
          enforcementMode: mode,
          warningThreshold: 80,
          countScope: "monthly",
          used,
        });

        expect(state.warningLevel).toBe("none");
      })
    );
  });

  it("checkLimitAction blocks exactly when block mode and used + requested exceeds the max", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 50 }),
        modeArb,
        (maxValue, used, requested, mode) => {
          const decision = checkLimitAction({
            metricKey: metric.key,
            metricName: metric.name,
            used,
            requested,
            maxValue,
            enforcementMode: mode,
          });

          const shouldBlock = mode === "block" && used + requested > maxValue;
          expect(decision.allowed).toBe(!shouldBlock);
        }
      )
    );
  });

  it("checkLimitAction never blocks an unlimited metric or a none-mode metric", () => {
    fc.assert(
      fc.property(usedArb, fc.integer({ min: 0, max: 50 }), (used, requested) => {
        const unlimited = checkLimitAction({
          metricKey: metric.key,
          metricName: metric.name,
          used,
          requested,
          maxValue: null,
          enforcementMode: "block",
        });
        const noneMode = checkLimitAction({
          metricKey: metric.key,
          metricName: metric.name,
          used,
          requested,
          maxValue: 1,
          enforcementMode: "none",
        });

        expect(unlimited.allowed).toBe(true);
        expect(noneMode.allowed).toBe(true);
      })
    );
  });
});

describe("salon extras pricing (properties)", () => {
  it("extra price is zero for gifts and otherwise unit price times quantity rounded to cents", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 1, max: 99 }),
        fc.boolean(),
        (unitPrice, quantity, isGift) => {
          const override: SalonPlanOverride = {
            id: "ov",
            salonId: "s",
            salonName: "s",
            moduleKey: null,
            metricKey: null,
            moduleEnabled: null,
            maxDelta: null,
            maxOverride: null,
            enforcementMode: null,
            warningThreshold: null,
            reason: "",
            startsAt: null,
            endsAt: null,
            status: "active",
            addonId: null,
            quantity,
            isGift,
            priceOverride: null,
          };
          const price = extraMonthlyPrice(override, { monthlyPrice: unitPrice });

          if (isGift) {
            expect(price).toBe(0);
          } else {
            expect(price).toBe(Math.round(unitPrice * quantity * 100) / 100);
          }
        }
      )
    );
  });

});
