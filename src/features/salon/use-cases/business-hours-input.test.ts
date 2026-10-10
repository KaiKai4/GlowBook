import { describe, expect, it } from "vitest";
import { err, ok } from "@/infra/result";
import { parseBusinessHoursJson } from "./business-hours-input";

const INVALID_JSON = "Datos de horario inválidos.";

function week(openDay: { day_of_week: number; open_time: string; close_time: string }) {
  return Array.from({ length: 7 }, (_, day) =>
    day === openDay.day_of_week
      ? { day_of_week: day, is_open: true, open_time: openDay.open_time, close_time: openDay.close_time }
      : { day_of_week: day, is_open: false, open_time: null, close_time: null }
  );
}

describe("parseBusinessHoursJson", () => {
  it("rechaza texto que no es JSON", () => {
    expect(parseBusinessHoursJson("{no-json")).toEqual(err(INVALID_JSON));
  });

  it("rechaza un horario que no tiene exactamente 7 días", () => {
    expect(parseBusinessHoursJson(JSON.stringify([]))).toEqual(
      err("Too small: expected array to have exactly 7 items")
    );
  });

  it("rechaza un día donde el cierre no es posterior a la apertura", () => {
    const json = JSON.stringify(week({ day_of_week: 2, open_time: "18:00", close_time: "09:00" }));

    expect(parseBusinessHoursJson(json)).toEqual(err("La hora de cierre debe ser mayor que la de apertura."));
  });

  it("devuelve los 7 días validados", () => {
    const days = week({ day_of_week: 0, open_time: "09:00", close_time: "18:00" });

    expect(parseBusinessHoursJson(JSON.stringify(days))).toEqual(ok(days));
  });
});
