import { describe, expect, it } from "vitest";
import { isDormantSalon } from "./salon-health";

const now = new Date("2026-06-11T12:00:00.000Z");

describe("salón health", () => {
  it("marks a salón dormant when its last appointment is older than the threshold", () => {
    expect(
      isDormantSalon({
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastAppointmentAt: "2026-05-01T10:00:00.000Z",
        now,
      })
    ).toBe(true);
  });

  it("keeps a salón healthy with recent activity", () => {
    expect(
      isDormantSalon({
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastAppointmentAt: "2026-06-05T10:00:00.000Z",
        now,
      })
    ).toBe(false);
  });

  it("uses the creation date when the salón never booked", () => {
    expect(
      isDormantSalon({
        isActive: true,
        createdAt: "2026-04-01T00:00:00.000Z",
        lastAppointmentAt: null,
        now,
      })
    ).toBe(true);
    expect(
      isDormantSalon({
        isActive: true,
        createdAt: "2026-06-01T00:00:00.000Z",
        lastAppointmentAt: null,
        now,
      })
    ).toBe(false);
  });

  it("never marks suspended salons as dormant", () => {
    expect(
      isDormantSalon({
        isActive: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastAppointmentAt: null,
        now,
      })
    ).toBe(false);
  });
});
