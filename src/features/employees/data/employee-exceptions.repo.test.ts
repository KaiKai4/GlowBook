import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  type FakeDbResponse,
  type FakeSupabase,
  type FakeSupabaseClient,
} from "@/test/access-employees-supabase-fake";
import {
  deleteEmployeeException,
  findUpcomingEmployeeExceptions,
  insertEmployeeException,
} from "./employee-exceptions.repo";

// Días libres: las consultas deben acotar por colaborador y salón, y solo
// devolver fechas desde hoy en adelante.

const serverHolder = vi.hoisted(() => ({ current: null as FakeSupabaseClient | null }));

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverHolder.current,
}));

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";

let db: FakeSupabase;

function useTables(responses: Record<string, FakeDbResponse[]>) {
  db = createFakeSupabase(responses);
  serverHolder.current = db.client;
}

describe("employee exceptions repo", () => {
  beforeEach(() => {
    serverHolder.current = null;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("findUpcomingEmployeeExceptions", () => {
    it("consulta solo días desde hoy en adelante del colaborador y salón, ordenados por fecha", async () => {
      useTables({
        schedule_exceptions: [
          {
            data: [{ id: "ex-1", exception_date: "2026-10-10", reason: "Feriado" }],
          },
        ],
      });

      await expect(findUpcomingEmployeeExceptions(EMPLOYEE_ID, SALON_ID)).resolves.toEqual([
        { id: "ex-1", exception_date: "2026-10-10", reason: "Feriado" },
      ]);

      expect(db.callsFor("schedule_exceptions").map((call) => [call.method, call.args])).toEqual([
        ["select", ["id, exception_date, reason"]],
        ["eq", ["employee_id", EMPLOYEE_ID]],
        ["eq", ["salon_id", SALON_ID]],
        ["gte", ["exception_date", "2026-10-09"]],
        ["order", ["exception_date", { ascending: true }]],
      ]);
    });

    it("usa la fecha UTC de hoy como límite inferior", async () => {
      vi.setSystemTime(new Date("2026-12-31T23:30:00.000Z"));
      useTables({ schedule_exceptions: [{ data: [] }] });

      await findUpcomingEmployeeExceptions(EMPLOYEE_ID, SALON_ID);

      expect(db.argsOf("schedule_exceptions", "gte")).toEqual([
        "exception_date",
        "2026-12-31",
      ]);
    });

    it("devuelve lista vacía sin datos y propaga errores", async () => {
      useTables({ schedule_exceptions: [{ data: null }] });
      await expect(findUpcomingEmployeeExceptions(EMPLOYEE_ID, SALON_ID)).resolves.toEqual([]);

      useTables({ schedule_exceptions: [{ error: { message: "caido" } }] });
      await expect(findUpcomingEmployeeExceptions(EMPLOYEE_ID, SALON_ID)).rejects.toEqual({
        message: "caido",
      });
    });
  });

  describe("insertEmployeeException", () => {
    it("inserta el día libre con salon_id y colaborador del contexto", async () => {
      useTables({ schedule_exceptions: [{}] });

      await insertEmployeeException({
        salonId: SALON_ID,
        employeeId: EMPLOYEE_ID,
        exceptionDate: "2026-10-15",
        reason: "Vacaciones",
      });

      expect(db.argsOf("schedule_exceptions", "insert")).toEqual([
        {
          salon_id: SALON_ID,
          employee_id: EMPLOYEE_ID,
          exception_date: "2026-10-15",
          reason: "Vacaciones",
        },
      ]);
    });

    it("propaga el error de inserción", async () => {
      useTables({ schedule_exceptions: [{ error: { message: "duplicado" } }] });

      await expect(
        insertEmployeeException({
          salonId: SALON_ID,
          employeeId: EMPLOYEE_ID,
          exceptionDate: "2026-10-15",
          reason: "x",
        })
      ).rejects.toEqual({ message: "duplicado" });
    });
  });

  describe("deleteEmployeeException", () => {
    it("borra el día libre solo si pertenece al colaborador y al salón", async () => {
      useTables({ schedule_exceptions: [{}] });

      await deleteEmployeeException("ex-1", EMPLOYEE_ID, SALON_ID);

      expect(db.callsFor("schedule_exceptions").map((call) => [call.method, call.args])).toEqual([
        ["delete", []],
        ["eq", ["id", "ex-1"]],
        ["eq", ["employee_id", EMPLOYEE_ID]],
        ["eq", ["salon_id", SALON_ID]],
      ]);
    });

    it("propaga el error de borrado", async () => {
      useTables({ schedule_exceptions: [{ error: { message: "no borrable" } }] });

      await expect(deleteEmployeeException("ex-1", EMPLOYEE_ID, SALON_ID)).rejects.toEqual({
        message: "no borrable",
      });
    });
  });
});
