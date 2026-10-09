import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { deleteWorkSchedule, upsertWorkSchedule } from "../data/employees.repo";
import type { WorkScheduleInput } from "../schemas";
import { addEmployeeWorkSchedule, removeEmployeeWorkSchedule } from "./employee-schedule";

// Bloques de horario semanal. La regla central es que la hora de fin sea
// estrictamente posterior a la de inicio; HH:MM con ceros a la izquierda se
// compara como texto, así que el orden lexicográfico debe coincidir con el horario.

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("../data/employees.repo", () => ({
  deleteWorkSchedule: vi.fn(),
  upsertWorkSchedule: vi.fn(),
}));

const mockedCaptureError = vi.mocked(captureError);
const mockedUpsert = vi.mocked(upsertWorkSchedule);
const mockedDelete = vi.mocked(deleteWorkSchedule);

const SALON_ID = "salon-1";

function scheduleOf(overrides: Partial<WorkScheduleInput> = {}): WorkScheduleInput {
  return {
    employee_id: "00000000-0000-4000-8000-000000000001",
    day_of_week: 1,
    start_time: "09:00",
    end_time: "17:00",
    is_active: true,
    ...overrides,
  };
}

// Horas válidas HH:MM con minutos múltiplos de cinco para que el generador sea legible.
const hhmm = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 11 }))
  .map(([hours, slot]) => `${String(hours).padStart(2, "0")}:${String(slot * 5).padStart(2, "0")}`);

describe("employee work schedule", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedDelete.mockResolvedValue(undefined);
  });

  describe("addEmployeeWorkSchedule", () => {
    it("guarda el bloque válido con el salón del contexto", async () => {
      const schedule = scheduleOf();

      const result = await addEmployeeWorkSchedule(SALON_ID, schedule);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedUpsert).toHaveBeenCalledWith(SALON_ID, schedule);
    });

    it("rechaza un bloque donde la hora de fin es igual a la de inicio", async () => {
      const result = await addEmployeeWorkSchedule(
        SALON_ID,
        scheduleOf({ start_time: "10:00", end_time: "10:00" })
      );

      expect(result).toEqual({
        ok: false,
        error: "La hora de fin debe ser mayor que la de inicio.",
      });
      expect(mockedUpsert).not.toHaveBeenCalled();
    });

    it("rechaza un bloque que termina antes de empezar", async () => {
      const result = await addEmployeeWorkSchedule(
        SALON_ID,
        scheduleOf({ start_time: "18:00", end_time: "09:00" })
      );

      expect(result.ok).toBe(false);
      expect(mockedUpsert).not.toHaveBeenCalled();
    });

    it("property: acepta exactamente cuando la fin es posterior al inicio", async () => {
      await fc.assert(
        fc.asyncProperty(hhmm, hhmm, async (start, end) => {
          mockedUpsert.mockClear();

          const result = await addEmployeeWorkSchedule(
            SALON_ID,
            scheduleOf({ start_time: start, end_time: end })
          );

          expect(result.ok).toBe(end > start);
          expect(mockedUpsert.mock.calls.length).toBe(end > start ? 1 : 0);
        })
      );
    });

    it("traduce un fallo de guardado a mensaje de negocio y registra el error", async () => {
      const failure = new Error("solapado");
      mockedUpsert.mockRejectedValue(failure);

      const result = await addEmployeeWorkSchedule(SALON_ID, scheduleOf());

      expect(result).toEqual({
        ok: false,
        error: "Error al guardar el horario (¿ya existe ese bloque?).",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
        module: "employees",
        action: "schedule",
      });
    });
  });

  describe("removeEmployeeWorkSchedule", () => {
    it("elimina el bloque solo dentro del salón indicado", async () => {
      const result = await removeEmployeeWorkSchedule(SALON_ID, "ws-1");

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedDelete).toHaveBeenCalledWith("ws-1", SALON_ID);
    });

    it("devuelve error genérico y registra el fallo al eliminar", async () => {
      const failure = new Error("caido");
      mockedDelete.mockRejectedValue(failure);

      const result = await removeEmployeeWorkSchedule(SALON_ID, "ws-1");

      expect(result).toEqual({ ok: false, error: "Error al eliminar el horario." });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
        module: "employees",
        action: "schedule",
      });
    });
  });
});
