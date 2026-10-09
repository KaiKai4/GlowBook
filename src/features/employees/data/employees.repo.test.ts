import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  type FakeDbResponse,
  type FakeSupabase,
  type FakeSupabaseClient,
} from "@/test/access-employees-supabase-fake";
import {
  createEmployee,
  findActiveEmployeeNames,
  findEmployeeByEmail,
  findEmployeeById,
  findEmployeeListRows,
  findEmployees,
  findLatestEmployeeInvitation,
  deleteWorkSchedule,
  updateEmployee,
  updateEmployeeProfileRecord,
  upsertWorkSchedule,
  findActiveAssignmentReferences,
} from "./employees.repo";
import { createEmployeeWithAssignmentsRpc } from "@/features/employees/data/rpc/create-employee-rpc";
import { updateEmployeeProfileRpc } from "@/features/employees/data/rpc/update-employee-rpc";

// Repositorio de colaboradores (cliente de servidor con RLS). Aun así, cada
// consulta multi-tenant debe filtrar por salon_id explícitamente, y las
// validaciones de asignación no deben aceptar servicios o categorías ajenos.

const serverHolder = vi.hoisted(() => ({ current: null as FakeSupabaseClient | null }));

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
const CATEGORY_B = "cat-b";
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

describe("employees repo", () => {
  beforeEach(() => {
    serverHolder.current = null;
  });

  describe("findEmployees", () => {
    it("filtra por salón y ordena por apellido, sin filtrar activos si no se pide", async () => {
      useTables({ employees: [{ data: [{ id: EMPLOYEE_ID }] }] });

      await expect(findEmployees(SALON_ID)).resolves.toEqual([{ id: EMPLOYEE_ID }]);

      expect(eqCalls("employees")).toEqual([["salon_id", SALON_ID]]);
      expect(db.argsOf("employees", "order")).toEqual(["last_name", { ascending: true }]);
    });

    it("agrega el filtro de activos cuando se pide explícitamente, también para false", async () => {
      useTables({ employees: [{ data: [] }, { data: [] }] });

      await findEmployees(SALON_ID, true);
      await findEmployees(SALON_ID, false);

      expect(eqCalls("employees")).toEqual([
        ["salon_id", SALON_ID],
        ["is_active", true],
        ["salon_id", SALON_ID],
        ["is_active", false],
      ]);
    });

    it("pide servicios, categorías y horarios anidados", async () => {
      useTables({ employees: [{ data: [] }] });

      await findEmployees(SALON_ID);

      const selected = db.argsOf("employees", "select")?.[0];
      expect(selected).toEqual(expect.stringContaining("employee_services"));
      expect(selected).toEqual(expect.stringContaining("employee_categories"));
      expect(selected).toEqual(expect.stringContaining("work_schedules"));
    });

    it("devuelve lista vacía sin datos y propaga errores de la consulta", async () => {
      useTables({ employees: [{ data: null }] });
      await expect(findEmployees(SALON_ID)).resolves.toEqual([]);

      useTables({ employees: [{ error: { message: "caido" } }] });
      await expect(findEmployees(SALON_ID)).rejects.toEqual({ message: "caido" });
    });
  });

  describe("findEmployeeListRows", () => {
    it("filtra por salón, aplica el filtro de activos opcional y devuelve las filas", async () => {
      const rows = [{ id: EMPLOYEE_ID, is_active: true }];
      useTables({ employees: [{ data: rows }, { data: null }] });

      await expect(findEmployeeListRows(SALON_ID, true)).resolves.toEqual(rows);
      await expect(findEmployeeListRows(SALON_ID)).resolves.toEqual([]);

      expect(eqCalls("employees")).toEqual([
        ["salon_id", SALON_ID],
        ["is_active", true],
        ["salon_id", SALON_ID],
      ]);
    });

    it("propaga el error de la consulta", async () => {
      useTables({ employees: [{ error: { message: "fallo" } }] });

      await expect(findEmployeeListRows(SALON_ID)).rejects.toEqual({ message: "fallo" });
    });
  });

  describe("findActiveEmployeeNames", () => {
    it("lista solo empleados activos del salón ordenados por nombre", async () => {
      useTables({ employees: [{ data: [{ id: EMPLOYEE_ID, first_name: "Ana", last_name: "L" }] }] });

      await expect(findActiveEmployeeNames(SALON_ID)).resolves.toEqual([
        { id: EMPLOYEE_ID, first_name: "Ana", last_name: "L" },
      ]);

      expect(eqCalls("employees")).toEqual([
        ["salon_id", SALON_ID],
        ["is_active", true],
      ]);
      expect(db.argsOf("employees", "order")).toEqual(["first_name"]);
    });

    it("devuelve lista vacía sin datos y propaga errores", async () => {
      useTables({ employees: [{ data: null }] });
      await expect(findActiveEmployeeNames(SALON_ID)).resolves.toEqual([]);

      useTables({ employees: [{ error: { message: "caido" } }] });
      await expect(findActiveEmployeeNames(SALON_ID)).rejects.toEqual({ message: "caido" });
    });
  });

  describe("findEmployeeById", () => {
    it("busca por id y salón y devuelve el colaborador", async () => {
      useTables({ employees: [{ data: { id: EMPLOYEE_ID } }] });

      await expect(findEmployeeById(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({ id: EMPLOYEE_ID });

      expect(eqCalls("employees")).toEqual([
        ["id", EMPLOYEE_ID],
        ["salon_id", SALON_ID],
      ]);
      expect(db.callsFor("employees").map((call) => call.method)).toContain("single");
    });

    it("devuelve null cuando la consulta falla o no encuentra al colaborador", async () => {
      useTables({ employees: [{ error: { message: "no encontrado" } }] });
      await expect(findEmployeeById(EMPLOYEE_ID, SALON_ID)).resolves.toBeNull();

      useTables({ employees: [{ data: null }] });
      await expect(findEmployeeById(EMPLOYEE_ID, SALON_ID)).resolves.toBeNull();
    });
  });

  describe("findEmployeeByEmail", () => {
    it("busca el email sin distinguir mayúsculas dentro del salón", async () => {
      useTables({ employees: [{ data: { id: EMPLOYEE_ID, email: "ana@salon.test" } }] });

      await expect(findEmployeeByEmail("ANA@salon.test", SALON_ID)).resolves.toEqual({
        id: EMPLOYEE_ID,
        email: "ana@salon.test",
      });

      expect(db.argsOf("employees", "ilike")).toEqual(["email", "ANA@salon.test"]);
      expect(eqCalls("employees")).toEqual([["salon_id", SALON_ID]]);
    });

    it("devuelve null cuando no hay coincidencias", async () => {
      useTables({ employees: [{ data: null }] });

      await expect(findEmployeeByEmail("nadie@salon.test", SALON_ID)).resolves.toBeNull();
    });
  });

  describe("findActiveAssignmentReferences", () => {
    it("no consulta nada cuando no hay servicios ni categorías", async () => {
      useTables({});

      await expect(findActiveAssignmentReferences(SALON_ID, [], [])).resolves.toEqual({
        activeCategoryIds: [],
        services: [],
      });
      expect(db.calls).toHaveLength(0);
    });

    it("consulta las categorías activas del salón y devuelve sus ids", async () => {
      useTables({ service_categories: [{ data: [{ id: CATEGORY_A }] }] });

      const result = await findActiveAssignmentReferences(SALON_ID, [], [CATEGORY_A, CATEGORY_B]);

      expect(result.activeCategoryIds).toEqual([CATEGORY_A]);
      expect(db.callsFor("service_categories").map((call) => [call.method, call.args])).toEqual([
        ["select", ["id"]],
        ["eq", ["salon_id", SALON_ID]],
        ["eq", ["is_active", true]],
        ["in", ["id", [CATEGORY_A, CATEGORY_B]]],
      ]);
    });

    it("propaga el error de consulta de categorías", async () => {
      useTables({ service_categories: [{ error: { message: "caido" } }] });

      await expect(findActiveAssignmentReferences(SALON_ID, [], [CATEGORY_A])).rejects.toEqual({
        message: "caido",
      });
    });

    it("consulta los servicios activos del salón con su categoría", async () => {
      useTables({
        services: [{ data: [{ id: SERVICE_1, category_id: CATEGORY_A }] }],
      });

      const result = await findActiveAssignmentReferences(SALON_ID, [SERVICE_1], []);

      expect(result).toEqual({
        activeCategoryIds: [],
        services: [{ id: SERVICE_1, category_id: CATEGORY_A }],
      });
      expect(db.argsOf("services", "in")).toEqual(["id", [SERVICE_1]]);
      expect(eqCalls("services")).toEqual([
        ["salon_id", SALON_ID],
        ["is_active", true],
      ]);
    });

    it("propaga el error de consulta de servicios", async () => {
      useTables({ services: [{ error: { message: "servicios caidos" } }] });

      await expect(findActiveAssignmentReferences(SALON_ID, [SERVICE_1], [])).rejects.toEqual({
        message: "servicios caidos",
      });
    });
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

  describe("work schedules", () => {
    const schedule = {
      employee_id: EMPLOYEE_ID,
      day_of_week: 1,
      start_time: "09:00",
      end_time: "17:00",
      is_active: true,
    };

    it("hace upsert del bloque con salon_id y el conflicto por salón, empleado, día y horas", async () => {
      useTables({ work_schedules: [{ data: { id: "ws-1" } }] });

      await expect(upsertWorkSchedule(SALON_ID, schedule)).resolves.toEqual({ id: "ws-1" });

      expect(db.argsOf("work_schedules", "upsert")).toEqual([
        { ...schedule, salon_id: SALON_ID },
        { onConflict: "salon_id,employee_id,day_of_week,start_time,end_time" },
      ]);
    });

    it("propaga el error de upsert", async () => {
      useTables({ work_schedules: [{ error: { message: "solapado" } }] });

      await expect(upsertWorkSchedule(SALON_ID, schedule)).rejects.toEqual({ message: "solapado" });
    });

    it("borra un bloque solo dentro del salón indicado", async () => {
      useTables({ work_schedules: [{}] });

      await deleteWorkSchedule("ws-1", SALON_ID);

      expect(eqCalls("work_schedules")).toEqual([
        ["id", "ws-1"],
        ["salon_id", SALON_ID],
      ]);
    });

    it("propaga el error de borrado", async () => {
      useTables({ work_schedules: [{ error: { message: "no borrable" } }] });

      await expect(deleteWorkSchedule("ws-1", SALON_ID)).rejects.toEqual({
        message: "no borrable",
      });
    });
  });

  describe("findLatestEmployeeInvitation", () => {
    it("devuelve la invitación más reciente sin exponer el token", async () => {
      const row = {
        id: "inv-1",
        email: "ana@salon.test",
        role_id: null,
        expires_at: "2026-10-16T00:00:00.000Z",
        accepted_at: null,
      };
      useTables({ employee_invitations: [{ data: row }] });

      await expect(findLatestEmployeeInvitation(EMPLOYEE_ID, SALON_ID)).resolves.toEqual(row);

      expect(db.argsOf("employee_invitations", "select")).toEqual([
        "id, email, role_id, expires_at, accepted_at",
      ]);
      expect(eqCalls("employee_invitations")).toEqual([
        ["employee_id", EMPLOYEE_ID],
        ["salon_id", SALON_ID],
      ]);
      expect(db.argsOf("employee_invitations", "order")).toEqual([
        "created_at",
        { ascending: false },
      ]);
    });

    it("devuelve null cuando no hay invitaciones", async () => {
      useTables({ employee_invitations: [{ data: null }] });

      await expect(findLatestEmployeeInvitation(EMPLOYEE_ID, SALON_ID)).resolves.toBeNull();
    });
  });
});
