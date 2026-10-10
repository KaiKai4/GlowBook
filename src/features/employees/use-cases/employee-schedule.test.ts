import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import type { deleteWorkSchedule, upsertWorkSchedule } from "../data/work-schedules.repo";
import type { WorkScheduleInput } from "../schemas";
import {
  addEmployeeWorkSchedule,
  removeEmployeeWorkSchedule,
  type EmployeeScheduleDeps,
} from "./employee-schedule";

// Bloques de horario semanal. La regla central es que la hora de fin sea
// estrictamente posterior a la de inicio; HH:MM con ceros a la izquierda se
// compara como texto, así que el orden lexicográfico debe coincidir con el horario.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedCaptureError = vi.mocked(captureError);

const SALON_ID = "salon-1";

function fakeScheduleDeps() {
  return {
    upsertSchedule: vi.fn<typeof upsertWorkSchedule>(),
    deleteSchedule: vi.fn<typeof deleteWorkSchedule>(),
  } satisfies Record<keyof EmployeeScheduleDeps, unknown>;
}

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
  let deps: ReturnType<typeof fakeScheduleDeps>;

  beforeEach(() => {
    vi.resetAllMocks();
    deps = fakeScheduleDeps();
    deps.deleteSchedule.mockResolvedValue(undefined);
  });

  describe("addEmployeeWorkSchedule", () => {
    it("guarda el bloque válido con el salón del contexto", async () => {
      const schedule = scheduleOf();

      const result = await addEmployeeWorkSchedule(SALON_ID, schedule, deps);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(deps.upsertSchedule).toHaveBeenCalledWith(SALON_ID, schedule);
    });

    it("rechaza un bloque donde la hora de fin es igual a la de inicio", async () => {
      const result = await addEmployeeWorkSchedule(
        SALON_ID,
        scheduleOf({ start_time: "10:00", end_time: "10:00" }),
        deps
      );

      expect(result).toEqual({
        ok: false,
        error: "La hora de fin debe ser mayor que la de inicio.",
      });
      expect(deps.upsertSchedule).not.toHaveBeenCalled();
    });

    it("rechaza un bloque que termina antes de empezar", async () => {
      const result = await addEmployeeWorkSchedule(
        SALON_ID,
        scheduleOf({ start_time: "18:00", end_time: "09:00" }),
        deps
      );

      expect(result.ok).toBe(false);
      expect(deps.upsertSchedule).not.toHaveBeenCalled();
    });

    it("property: acepta exactamente cuando la fin es posterior al inicio", async () => {
      await fc.assert(
        fc.asyncProperty(hhmm, hhmm, async (start, end) => {
          deps.upsertSchedule.mockClear();

          const result = await addEmployeeWorkSchedule(
            SALON_ID,
            scheduleOf({ start_time: start, end_time: end }),
            deps
          );

          expect(result.ok).toBe(end > start);
          expect(deps.upsertSchedule.mock.calls.length).toBe(end > start ? 1 : 0);
        })
      );
    });

    it("traduce un fallo de guardado a mensaje de negocio y registra el error", async () => {
      const failure = new Error("solapado");
      deps.upsertSchedule.mockRejectedValue(failure);

      const result = await addEmployeeWorkSchedule(SALON_ID, scheduleOf(), deps);

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
      const result = await removeEmployeeWorkSchedule(SALON_ID, "ws-1", deps);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(deps.deleteSchedule).toHaveBeenCalledWith("ws-1", SALON_ID);
    });

    it("devuelve error genérico y registra el fallo al eliminar", async () => {
      const failure = new Error("caido");
      deps.deleteSchedule.mockRejectedValue(failure);

      const result = await removeEmployeeWorkSchedule(SALON_ID, "ws-1", deps);

      expect(result).toEqual({ ok: false, error: "Error al eliminar el horario." });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
        module: "employees",
        action: "schedule",
      });
    });
  });
});
