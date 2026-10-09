import { afterEach, describe, expect, it, vi } from "vitest";
import { getZonedTimeParts } from "./dates";

// El formateador de Intl siempre trae día de la semana para zonas válidas; para
// cubrir el camino de respaldo se simula un formateador con partes incompletas.
function stubFormatter(parts: Array<{ type: string; value: string }>): void {
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function FakeDateTimeFormat() {
    return { formatToParts: () => parts };
  } as unknown as typeof Intl.DateTimeFormat);
}

describe("getZonedTimeParts (respaldo de día de la semana)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sin día de la semana en las partes devuelve lunes (0) y conserva la hora", () => {
    stubFormatter([
      { type: "hour", value: "09" },
      { type: "minute", value: "30" },
    ]);

    expect(getZonedTimeParts(new Date("2026-10-12T14:30:00.000Z"), "America/Panama")).toEqual({
      dayOfWeek: 0,
      minutesOfDay: 9 * 60 + 30,
    });
  });

  it("con un día de la semana que no reconoce devuelve lunes (0)", () => {
    stubFormatter([
      { type: "weekday", value: "Xyz" },
      { type: "hour", value: "10" },
      { type: "minute", value: "05" },
    ]);

    expect(getZonedTimeParts(new Date("2026-10-12T15:05:00.000Z"), "America/Panama")).toEqual({
      dayOfWeek: 0,
      minutesOfDay: 10 * 60 + 5,
    });
  });
});
