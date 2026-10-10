import { describe, expect, it } from "vitest";
import { isSameLocalDay, localDateStr } from "./local-date";

const TZ = "America/Panama";

describe("localDateStr e isSameLocalDay", () => {
  it("expresa la fecha en la zona horaria del salón", () => {
    // 02:00 UTC del 13 de junio es el 12 de junio en Panamá (UTC-5, sin horario de verano).
    expect(localDateStr("2026-06-13T02:00:00.000Z", TZ)).toBe("2026-06-12");
  });

  it("compara días locales y considera que una fecha ausente nunca coincide", () => {
    expect(isSameLocalDay("2026-06-13T02:00:00.000Z", "2026-06-12", TZ)).toBe(true);
    expect(isSameLocalDay("2026-06-13T02:00:00.000Z", "2026-06-13", TZ)).toBe(false);
    expect(isSameLocalDay(null, "2026-06-12", TZ)).toBe(false);
  });
});
