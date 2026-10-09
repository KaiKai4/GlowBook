import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { isDormantSalon } from "./salon-health";

// Propiedades de la regla de salon dormido: el umbral es estricto (mas de N
// dias), la ultima cita manda sobre la creacion y las fechas invalidas nunca
// marcan un salon como dormido.

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-30T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

describe("isDormantSalon properties", () => {
  it("never marks an inactive salon as dormant, whatever its dates", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2000 }),
        fc.option(fc.integer({ min: 0, max: 2000 }), { nil: null }),
        (createdDaysAgo, lastDaysAgo) => {
          const dormant = isDormantSalon({
            isActive: false,
            createdAt: daysAgo(createdDaysAgo),
            lastAppointmentAt: lastDaysAgo === null ? null : daysAgo(lastDaysAgo),
            now: NOW,
          });
          return dormant === false;
        }
      )
    );
  });

  it("is dormant exactly when the reference is strictly older than the threshold", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 1, max: 120 }),
        (referenceDaysAgo, thresholdDays) => {
          const dormant = isDormantSalon({
            isActive: true,
            createdAt: daysAgo(referenceDaysAgo),
            lastAppointmentAt: null,
            now: NOW,
            dormantAfterDays: thresholdDays,
          });
          return dormant === referenceDaysAgo > thresholdDays;
        }
      )
    );
  });

  it("uses the 30-day default threshold when none is given", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), (referenceDaysAgo) => {
        const dormant = isDormantSalon({
          isActive: true,
          createdAt: daysAgo(referenceDaysAgo),
          lastAppointmentAt: null,
          now: NOW,
        });
        return dormant === referenceDaysAgo > 30;
      })
    );
  });

  it("judges by the last appointment whenever one exists, ignoring the creation date", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 0, max: 400 }),
        (createdDaysAgo, lastDaysAgo) => {
          const dormant = isDormantSalon({
            isActive: true,
            createdAt: daysAgo(createdDaysAgo),
            lastAppointmentAt: daysAgo(lastDaysAgo),
            now: NOW,
          });
          return dormant === lastDaysAgo > 30;
        }
      )
    );
  });

  it("never marks a salon as dormant when its reference date cannot be parsed", () => {
    fc.assert(
      fc.property(fc.string(), (garbage) => {
        fc.pre(Number.isNaN(new Date(garbage).getTime()));
        const dormant = isDormantSalon({
          isActive: true,
          createdAt: garbage,
          lastAppointmentAt: null,
          now: NOW,
        });
        return dormant === false;
      })
    );
  });

  it("treats an unparseable last appointment as an invalid reference, even when the creation date is old", () => {
    const dormant = isDormantSalon({
      isActive: true,
      createdAt: daysAgo(900),
      lastAppointmentAt: "no-es-fecha",
      now: NOW,
    });

    expect(dormant).toBe(false);
  });
});
