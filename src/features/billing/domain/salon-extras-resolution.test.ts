import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { override } from "@/test/billing-plan-fixtures";
import type { PlanEnforcementMode, SalonPlanOverride } from "./commercial-plan";
import {
  buildSalonExtras,
  extraMonthlyPrice,
  resolveOverrideMax,
  resolveOverrideMode,
  resolveOverrideThreshold,
  type CommercialAddon,
} from "./salon-extras";

// Resolución de sobreescrituras de un salón: el primer valor explícito gana,
// los incrementos se suman multiplicados por la cantidad y los precios se
// redondean a centavos.

const addonA: CommercialAddon = {
  id: "addon-a",
  code: "clientes",
  name: "Clientes",
  description: "",
  kind: "limit_boost",
  moduleKey: null,
  metricKey: "customers_active",
  limitDelta: 50,
  currency: "USD",
  monthlyPrice: 8.25,
  status: "active",
  sortOrder: 0,
};

const addonB: CommercialAddon = {
  ...addonA,
  id: "addon-b",
  code: "reportes",
  name: "Reportes",
  kind: "module",
  moduleKey: "reports",
  metricKey: null,
  limitDelta: null,
  monthlyPrice: 10,
};

describe("buildSalonExtras", () => {
  it("empareja cada sobreescritura con su extra del catálogo y calcula su precio mensual", () => {
    const extras = buildSalonExtras(
      [
        override({ id: "ov-1", addonId: "addon-a", quantity: 2 }),
        override({ id: "ov-2", addonId: "addon-b", isGift: true }),
        override({ id: "ov-3", addonId: null, priceOverride: 3 }),
        override({ id: "ov-4", addonId: "catalogo-borrado", quantity: 1 }),
      ],
      [addonA, addonB]
    );

    expect(extras.map((extra) => [extra.override.id, extra.addon?.id ?? null, extra.monthlyPrice])).toEqual([
      ["ov-1", "addon-a", 16.5],
      ["ov-2", "addon-b", 0],
      ["ov-3", null, 3],
      ["ov-4", null, 0],
    ]);
  });

  it("devuelve una lista vacía cuando el salón no tiene sobreescrituras", () => {
    expect(buildSalonExtras([], [addonA])).toEqual([]);
  });
});

describe("extraMonthlyPrice: precio especial frente a catálogo", () => {
  it("usa el precio especial aunque sea cero, y no el precio de catálogo", () => {
    // El operador ?? solo cae al catálogo ante null o undefined: un 0 explícito se respeta.
    expect(extraMonthlyPrice(override({ priceOverride: 0, quantity: 3 }), addonA)).toBe(0);
  });
});

describe("resolveOverrideMax", () => {
  it("un tope fijo explícito aunque sea 0 reemplaza el máximo del plan", () => {
    expect(resolveOverrideMax(300, [override({ maxOverride: 0 }), override({ maxOverride: 900 })])).toBe(0);
  });

  it("los incrementos se aplican aunque el máximo base sea nulo, sin volverlo límite", () => {
    expect(resolveOverrideMax(null, [override({ maxDelta: 10, quantity: 3 })])).toBeNull();
  });

  it("trata un incremento nulo como cero", () => {
    expect(resolveOverrideMax(100, [override({ maxDelta: null, quantity: 5 })])).toBe(100);
  });

  it("property: sin tope fijo, el máximo es base más la suma de incrementos por cantidad", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.array(
          fc.record({ delta: fc.integer({ min: 0, max: 500 }), quantity: fc.integer({ min: 1, max: 20 }) }),
          { maxLength: 6 }
        ),
        (base, items) => {
          const overrides = items.map((item) => override({ maxDelta: item.delta, quantity: item.quantity }));
          const expected = base + items.reduce((total, item) => total + item.delta * item.quantity, 0);

          expect(resolveOverrideMax(base, overrides)).toBe(expected);
        }
      )
    );
  });

  it("property: con un tope fijo, el primero definido gana sin importar base ni incrementos", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 5000 }), { nil: null }),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 500 }),
        (base, fixed, laterFixed, delta) => {
          const overrides = [
            override({ maxDelta: delta }),
            override({ maxOverride: fixed }),
            override({ maxOverride: laterFixed }),
          ];

          expect(resolveOverrideMax(base, overrides)).toBe(fixed);
        }
      )
    );
  });
});

describe("resolveOverrideMode y resolveOverrideThreshold", () => {
  it("el primer modo de cumplimiento definido gana; sin ninguno se usa el base", () => {
    const modes: PlanEnforcementMode[] = ["block", "warn"];
    expect(resolveOverrideMode("none", [override({}), override({ enforcementMode: modes[0] }), override({ enforcementMode: modes[1] })])).toBe("block");
    expect(resolveOverrideMode("warn", [override({})])).toBe("warn");
    expect(resolveOverrideMode("block", [])).toBe("block");
  });

  it("un umbral de 0 es un valor explícito y gana sobre el base", () => {
    expect(resolveOverrideThreshold(80, [override({ warningThreshold: null }), override({ warningThreshold: 0 })])).toBe(0);
  });

  it("sin umbral explícito conserva el base", () => {
    expect(resolveOverrideThreshold(80, [override({ warningThreshold: null })])).toBe(80);
    expect(resolveOverrideThreshold(70, [])).toBe(70);
  });
});

describe("salon extras pricing (properties)", () => {
  const overrideArb = fc
    .record({
      isGift: fc.boolean(),
      quantity: fc.integer({ min: 1, max: 50 }),
      priceOverride: fc.option(fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }), { nil: null }),
      addonId: fc.option(fc.constantFrom("addon-a", "addon-b", "catalogo-borrado"), { nil: null }),
    })
    .map((partial): SalonPlanOverride => override(partial));

  it("property: el precio de cada extra es cero si es regalo y, si no, redondeado a centavos", () => {
    fc.assert(
      fc.property(overrideArb, (item) => {
        const addon = item.addonId === "addon-a" ? addonA : item.addonId === "addon-b" ? addonB : null;
        const price = extraMonthlyPrice(item, addon);

        if (item.isGift) {
          expect(price).toBe(0);
        } else {
          expect(price).toBe(Math.round(price * 100) / 100);
          expect(price).toBeGreaterThanOrEqual(0);
        }
      })
    );
  });

  it("property: buildSalonExtras conserva cada sobreescritura y su precio coincide con extraMonthlyPrice", () => {
    fc.assert(
      fc.property(fc.array(overrideArb, { maxLength: 8 }), (items) => {
        const expected = items.map((item) => {
          const addon = item.addonId === "addon-a" ? addonA : item.addonId === "addon-b" ? addonB : null;
          return { override: item, addon, monthlyPrice: extraMonthlyPrice(item, addon) };
        });

        expect(buildSalonExtras(items, [addonA, addonB])).toEqual(expected);
      })
    );
  });
});
