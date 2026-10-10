import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  type FakeDbResponse,
  type FakeSupabase,
  type FakeSupabaseClient,
} from "@/test/access-employees-supabase-fake";
import {
  findActiveAssignmentReferences,
  findActiveEmployeeNames,
  findEmployeeByEmail,
  findEmployeeById,
  findEmployeeListRows,
  findEmployees,
} from "./employees-read.repo";

// Lecturas del repositorio de colaboradores (cliente de servidor con RLS). Cada
// consulta multi-tenant debe filtrar por salon_id explícitamente, y las
// validaciones de asignación no deben aceptar servicios o categorías ajenos.

const serverHolder = vi.hoisted((): { current: FakeSupabaseClient | null } => ({ current: null }));

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverHolder.current,
}));

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";
const CATEGORY_A = "cat-a";
const CATEGORY_B = "cat-b";
const SERVICE_1 = "svc-1";

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

describe("employees read repo", () => {
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
      expect(db.callsFor("employees").map((call) => call.method)).toContain("maybeSingle");
    });

    it("devuelve null cuando no encuentra al colaborador y propaga errores de la consulta", async () => {
      useTables({ employees: [{ data: null }] });
      await expect(findEmployeeById(EMPLOYEE_ID, SALON_ID)).resolves.toBeNull();

      useTables({ employees: [{ error: { message: "no encontrado" } }] });
      await expect(findEmployeeById(EMPLOYEE_ID, SALON_ID)).rejects.toEqual({ message: "no encontrado" });
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

    it("propaga el error de la consulta en vez de devolver null", async () => {
      useTables({ employees: [{ error: { message: "caido" } }] });

      await expect(findEmployeeByEmail("ana@salon.test", SALON_ID)).rejects.toEqual({ message: "caido" });
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

});
