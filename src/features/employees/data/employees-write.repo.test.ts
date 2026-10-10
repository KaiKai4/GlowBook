import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  type FakeDbResponse,
  type FakeSupabase,
  type FakeSupabaseClient,
} from "@/test/access-employees-supabase-fake";
import {
  createEmployee,
  updateEmployee,
  updateEmployeeProfileRecord,
} from "./employees-write.repo";
import { createEmployeeWithAssignmentsRpc } from "@/features/employees/data/rpc/create-employee-rpc";
import { updateEmployeeProfileRpc } from "@/features/employees/data/rpc/update-employee-rpc";

// Escrituras del repositorio de colaboradores: alta y edicion por RPC transaccional
// y actualizacion directa acotada al salón.

const serverHolder = vi.hoisted((): { current: FakeSupabaseClient | null } => ({ current: null }));

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverHolder.current,
}));

vi.mock("@/features/employees/data/rpc/create-employee-rpc", () => ({
  createEmployeeWithAssignmentsRpc: vi.fn(),
}));

vi.mock("@/features/employees/data/rpc/update-employee-rpc", () => ({
  updateEmployeeProfileRpc: vi.fn(),
}));

const KEY = "00000000-0000-4000-8000-0000000000f1";
const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";
const CATEGORY_A = "cat-a";
const SERVICE_1 = "svc-1";
const SERVICE_2 = "svc-2";

let db: FakeSupabase;

function useTables(responses: Record<string, FakeDbResponse[]>) {
  db = createFakeSupabase(responses);
  serverHolder.current = db.client;
}

function eqCalls(table: string): unknown[][] {
  return db
    .callsFor(table)
    .filter((call) => call.method === "eq")
    .map((call) => call.args);
}

describe("employees write repo", () => {
  beforeEach(() => {
    serverHolder.current = null;
  });

  describe("createEmployee (RPC transaccional)", () => {
    const input = {
      first_name: "Ana",
      last_name: "Lopez",
      phone: "",
      email: "",
      specialty: "",
      commission_percentage: 0,
      hire_date: null,
    };

    it("delega el alta y sus asignaciones en una sola RPC con la clave de idempotencia", async () => {
      vi.mocked(createEmployeeWithAssignmentsRpc).mockResolvedValue({ employeeId: EMPLOYEE_ID });

      await expect(createEmployee(input, [SERVICE_1, SERVICE_2], [CATEGORY_A], KEY)).resolves.toEqual({
        id: EMPLOYEE_ID,
      });

      expect(createEmployeeWithAssignmentsRpc).toHaveBeenCalledTimes(1);
      expect(createEmployeeWithAssignmentsRpc).toHaveBeenCalledWith({
        employee: input,
        serviceIds: [SERVICE_1, SERVICE_2],
        categoryIds: [CATEGORY_A],
        idempotencyKey: KEY,
      });
    });

    it("propaga el error de la RPC sin escribir tablas sueltas", async () => {
      vi.mocked(createEmployeeWithAssignmentsRpc).mockRejectedValue({ message: "fk rota" });

      await expect(createEmployee(input, [SERVICE_1], [], KEY)).rejects.toEqual({ message: "fk rota" });
    });
  });

  describe("updateEmployeeProfileRecord (RPC transaccional)", () => {
    it("envia solo los campos presentes, las asignaciones indicadas y la clave", async () => {
      vi.mocked(updateEmployeeProfileRpc).mockResolvedValue({ employeeId: EMPLOYEE_ID });

      await updateEmployeeProfileRecord(EMPLOYEE_ID, {
        fields: { first_name: "Ana Maria" },
        unlinkProfile: false,
        idempotencyKey: KEY,
      });

      expect(updateEmployeeProfileRpc).toHaveBeenCalledWith({
        employeeId: EMPLOYEE_ID,
        fields: { first_name: "Ana Maria" },
        unlinkProfile: false,
        idempotencyKey: KEY,
      });
    });
  });


  describe("updateEmployee", () => {
    it("actualiza solo el colaborador del salón indicado y devuelve la fila", async () => {
      useTables({ employees: [{ data: { id: EMPLOYEE_ID, is_active: false } }] });

      await expect(updateEmployee(EMPLOYEE_ID, SALON_ID, { is_active: false })).resolves.toEqual({
        id: EMPLOYEE_ID,
        is_active: false,
      });

      expect(db.argsOf("employees", "update")).toEqual([{ is_active: false }]);
      expect(eqCalls("employees")).toEqual([
        ["id", EMPLOYEE_ID],
        ["salon_id", SALON_ID],
      ]);
    });

    it("propaga el error de actualización", async () => {
      useTables({ employees: [{ error: { message: "bloqueado" } }] });

      await expect(updateEmployee(EMPLOYEE_ID, SALON_ID, { first_name: "X" })).rejects.toEqual({
        message: "bloqueado",
      });
    });
  });
});
