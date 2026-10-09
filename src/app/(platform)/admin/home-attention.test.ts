import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRow } from "@/test/ui-admin-fixtures";
import { buildAttentionList } from "./home-attention";

describe("buildAttentionList", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no genera atenciones para salones sanos", () => {
    expect(buildAttentionList([makeRow()])).toEqual([]);
  });

  it("marca alertas de límite con texto en singular o plural", () => {
    const one = buildAttentionList([makeRow({ openAlertCount: 1 })]);
    const many = buildAttentionList([makeRow({ openAlertCount: 3 })]);

    expect(one).toEqual([
      expect.objectContaining({
        reason: "Límites",
        detail: "1 alerta de límite abierta.",
        severity: "danger",
      }),
    ]);
    expect(many[0]?.detail).toBe("3 alertas de límite abiertas.");
  });

  it("marca morosos como peligro", () => {
    const items = buildAttentionList([makeRow({ status: "past_due" })]);

    expect(items).toEqual([expect.objectContaining({ reason: "Moroso", severity: "danger" })]);
  });

  it("marca trials que vencen dentro de tres días con la fecha formateada", () => {
    const items = buildAttentionList([makeRow({ status: "trialing", trialEndsAt: "2026-06-12" })]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ reason: "Trial por vencer", severity: "warning" });
    expect(items[0]?.detail).toContain("12");
  });

  it("ignora trials que vencen después de tres días", () => {
    const items = buildAttentionList([makeRow({ status: "trialing", trialEndsAt: "2026-06-20" })]);

    expect(items).toEqual([]);
  });

  it("marca salones activos sin plan y no los inactivos", () => {
    const items = buildAttentionList([
      makeRow({ salonId: "a", planId: null, planName: null, salonIsActive: true }),
      makeRow({ salonId: "b", planId: null, planName: null, salonIsActive: false }),
    ]);

    expect(items.map((item) => item.salonId)).toEqual(["a"]);
    expect(items[0]).toMatchObject({ reason: "Sin plan", severity: "warning" });
  });

  it("ordena las atenciones de peligro antes que las de aviso", () => {
    const items = buildAttentionList([
      makeRow({ salonId: "a", planId: null, planName: null }),
      makeRow({ salonId: "b", status: "past_due" }),
    ]);

    expect(items.map((item) => item.severity)).toEqual(["danger", "warning"]);
  });
});
