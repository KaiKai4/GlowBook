import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import {
  deleteEmployeeException,
  insertEmployeeException,
} from "../data/employee-exceptions.repo";
import {
  addEmployeeScheduleException,
  removeEmployeeScheduleException,
} from "./employee-exceptions";

// Días libres del colaborador. Reglas: fecha con formato ISO, no en el pasado
// según la zona horaria del salón, motivo recortado a 200 caracteres y errores
// de BD traducidos a mensajes de negocio.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("../data/employee-exceptions.repo", () => ({
  deleteEmployeeException: vi.fn(),
  insertEmployeeException: vi.fn(),
}));

const mockedCaptureError = vi.mocked(captureError);
const mockedInsert = vi.mocked(insertEmployeeException);
const mockedDelete = vi.mocked(deleteEmployeeException);

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";
const TIMEZONE = "America/Bogota";

function baseInput(overrides: Partial<Parameters<typeof addEmployeeScheduleException>[0]> = {}) {
  return {
    salonId: SALON_ID,
    employeeId: EMPLOYEE_ID,
    exceptionDate: "2026-10-15",
    reason: "Vacaciones",
    timezone: TIMEZONE,
    ...overrides,
  };
}

describe("employee schedule exceptions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    // 2026-10-09 03:00 UTC es 2026-10-08 en Bogotá (UTC-5): "hoy" local es el 8.
    vi.setSystemTime(new Date("2026-10-09T03:00:00.000Z"));
    mockedInsert.mockResolvedValue(undefined);
    mockedDelete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("addEmployeeScheduleException", () => {
    it("guarda el día libre con salón, colaborador y motivo recortado", async () => {
      const result = await addEmployeeScheduleException(
        baseInput({ reason: "  Vacaciones  " })
      );

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedInsert).toHaveBeenCalledWith({
        salonId: SALON_ID,
        employeeId: EMPLOYEE_ID,
        exceptionDate: "2026-10-15",
        reason: "Vacaciones",
      });
    });

    it("recorta el motivo a 200 caracteres", async () => {
      await addEmployeeScheduleException(baseInput({ reason: "x".repeat(250) }));

      expect(mockedInsert).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "x".repeat(200) })
      );
    });

    it("rechaza fechas que no tienen formato AAAA-MM-DD sin consultar la BD", async () => {
      for (const exceptionDate of ["15/10/2026", "2026-10-1", "2026-10-15T00:00", ""]) {
        const result = await addEmployeeScheduleException(baseInput({ exceptionDate }));

        expect(result).toEqual({ ok: false, error: "Selecciona una fecha válida." });
      }
      expect(mockedInsert).not.toHaveBeenCalled();
    });

    it("rechaza fechas anteriores a hoy en la zona horaria del salón", async () => {
      const result = await addEmployeeScheduleException(
        baseInput({ exceptionDate: "2026-10-07" })
      );

      expect(result).toEqual({
        ok: false,
        error: "La fecha del día libre no puede estar en el pasado.",
      });
      expect(mockedInsert).not.toHaveBeenCalled();
    });

    it("acepta el día de hoy según la zona horaria aunque en UTC ya sea otro día", async () => {
      const result = await addEmployeeScheduleException(
        baseInput({ exceptionDate: "2026-10-08" })
      );

      expect(result).toEqual({ ok: true, value: undefined });
    });

    it("usa la zona horaria recibida: en UTC el mismo instante ya es el 9", async () => {
      const result = await addEmployeeScheduleException(
        baseInput({ exceptionDate: "2026-10-08", timezone: "UTC" })
      );

      expect(result).toEqual({
        ok: false,
        error: "La fecha del día libre no puede estar en el pasado.",
      });
    });

    it("traduce el choque con un día ya registrado a un mensaje de negocio", async () => {
      mockedInsert.mockRejectedValue(new Error("duplicate key value violates unique constraint schedule_exceptions_unique"));

      const result = await addEmployeeScheduleException(baseInput());

      expect(result.ok).toBe(false);
      expect(mockedCaptureError).not.toHaveBeenCalled();
    });

    it("cualquier otro error de guardado devuelve mensaje genérico y lo registra", async () => {
      const failure = new Error("conexión perdida");
      mockedInsert.mockRejectedValue(failure);

      const result = await addEmployeeScheduleException(baseInput());

      expect(result).toEqual({ ok: false, error: "No se pudo guardar el día libre." });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
        module: "employees",
        action: "exception-add",
      });
    });

    it("un fallo que no es Error también cae en el mensaje genérico", async () => {
      mockedInsert.mockRejectedValue({ code: "XX" });

      const result = await addEmployeeScheduleException(baseInput());

      expect(result).toEqual({ ok: false, error: "No se pudo guardar el día libre." });
    });
  });

  describe("removeEmployeeScheduleException", () => {
    it("elimina el día libre dentro del salón y colaborador indicados", async () => {
      const result = await removeEmployeeScheduleException(SALON_ID, EMPLOYEE_ID, "ex-1");

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedDelete).toHaveBeenCalledWith("ex-1", EMPLOYEE_ID, SALON_ID);
    });

    it("devuelve error genérico y registra el fallo al eliminar", async () => {
      const failure = new Error("caido");
      mockedDelete.mockRejectedValue(failure);

      const result = await removeEmployeeScheduleException(SALON_ID, EMPLOYEE_ID, "ex-1");

      expect(result).toEqual({ ok: false, error: "No se pudo eliminar el día libre." });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
        module: "employees",
        action: "exception-remove",
      });
    });
  });
});
