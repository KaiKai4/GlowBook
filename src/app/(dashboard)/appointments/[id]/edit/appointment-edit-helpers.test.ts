import { describe, expect, it } from "vitest";
import { localTime, rowKey } from "./appointment-edit-helpers";

describe("localTime", () => {
  it("expresa la hora en la zona horaria indicada en formato HH:mm", () => {
    // 19:30 UTC equivale a 14:30 en Panamá (UTC-5, sin horario de verano).
    expect(localTime(new Date("2026-10-09T19:30:00Z"), "America/Panama")).toBe("14:30");
  });

  it("muestra la medianoche como 00:00 y no como 24:00", () => {
    // 05:00 UTC equivale a 00:00 en Panamá.
    expect(localTime(new Date("2026-10-09T05:00:00Z"), "America/Panama")).toBe("00:00");
  });
});

describe("rowKey", () => {
  it("incluye el índice y genera claves distintas aunque el índice se repita", () => {
    const first = rowKey(0);
    const second = rowKey(0);

    expect(first.startsWith("edit-0-")).toBe(true);
    expect(first).not.toBe(second);
  });
});
