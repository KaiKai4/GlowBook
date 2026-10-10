import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeDbResponse, type FakeSupabase, type FakeSupabaseClient } from "@/test/access-employees-supabase-fake";
import { findAssignableEmployeeRole, findEmployeeAccessProfile, insertEmployeeProfile, linkEmployeeProfile, unlinkEmployeeProfile, updateEmployeeProfileRole } from "./employee-access.repo";

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminHolder.current,
}));

function useTables(responses: Record<string, FakeDbResponse[]>) {
  db = createFakeSupabase(responses);
  adminHolder.current = db.client;
}
const adminHolder = vi.hoisted(() => ({ current: null as FakeSupabaseClient | null }));
const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";
const PROFILE_ID = "profile-1";
let db: FakeSupabase;

describe("employee access repo", () => {
  beforeEach(() => {
    adminHolder.current = null;
  });

  describe("findAssignableEmployeeRole", () => {
    it("busca solo roles no de sistema del salón", async () => {
      useTables({ roles: [{ data: { id: "role-1" } }] });

      await expect(findAssignableEmployeeRole(SALON_ID, "role-1")).resolves.toEqual({
        data: { id: "role-1" },
        error: null,
      });

      expect(db.callsFor("roles").map((call) => [call.method, call.args])).toEqual([
        ["select", ["id"]],
        ["eq", ["id", "role-1"]],
        ["eq", ["salon_id", SALON_ID]],
        ["eq", ["is_system", false]],
        ["maybeSingle", []],
      ]);
    });

    it("devuelve data nulo cuando el rol no es asignable", async () => {
      useTables({ roles: [{ data: null }] });

      await expect(findAssignableEmployeeRole(SALON_ID, "role-x")).resolves.toEqual({
        data: null,
        error: null,
      });
    });
  });

  describe("findEmployeeAccessProfile", () => {
    it("filtra el perfil por id y salón y pide solo role_id e is_owner", async () => {
      useTables({ profiles: [{ data: { role_id: "role-1", is_owner: false } }] });

      await expect(findEmployeeAccessProfile(PROFILE_ID, SALON_ID)).resolves.toEqual({
        data: { role_id: "role-1", is_owner: false },
        error: null,
      });

      expect(db.argsOf("profiles", "select")).toEqual(["role_id, is_owner"]);
      expect(db.callsFor("profiles").filter((call) => call.method === "eq")).toEqual([
        { table: "profiles", method: "eq", args: ["id", PROFILE_ID] },
        { table: "profiles", method: "eq", args: ["salon_id", SALON_ID] },
      ]);
    });
  });

  describe("unlinkEmployeeProfile", () => {
    it("desvincula el perfil del empleado acotando por salón", async () => {
      useTables({ employees: [{}] });

      await unlinkEmployeeProfile(EMPLOYEE_ID, SALON_ID);

      expect(db.argsOf("employees", "update")).toEqual([{ profile_id: null }]);
      expect(db.callsFor("employees").filter((call) => call.method === "eq")).toEqual([
        { table: "employees", method: "eq", args: ["id", EMPLOYEE_ID] },
        { table: "employees", method: "eq", args: ["salon_id", SALON_ID] },
      ]);
    });

    it("devuelve el error de actualización", async () => {
      useTables({ employees: [{ error: { message: "bloqueado" } }] });

      await expect(unlinkEmployeeProfile(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        error: { message: "bloqueado" },
      });
    });
  });

  describe("updateEmployeeProfileRole", () => {
    it("cambia el rol del perfil acotado al salón, incluido el caso de quitar rol", async () => {
      useTables({ profiles: [{}, {}] });

      await updateEmployeeProfileRole(PROFILE_ID, SALON_ID, null);
      await updateEmployeeProfileRole(PROFILE_ID, SALON_ID, "role-2");

      const updates = db.callsFor("profiles").filter((call) => call.method === "update");
      expect(updates.map((call) => call.args)).toEqual([[{ role_id: null }], [{ role_id: "role-2" }]]);
      const eqs = db.callsFor("profiles").filter((call) => call.method === "eq");
      expect(eqs.map((call) => call.args)).toEqual([
        ["id", PROFILE_ID],
        ["salon_id", SALON_ID],
        ["id", PROFILE_ID],
        ["salon_id", SALON_ID],
      ]);
    });

    it("devuelve el error de actualización", async () => {
      useTables({ profiles: [{ error: { message: "rol rechazado" } }] });

      await expect(updateEmployeeProfileRole(PROFILE_ID, SALON_ID, "role-2")).resolves.toEqual({
        error: { message: "rol rechazado" },
      });
    });
  });

  describe("insertEmployeeProfile", () => {
    it("inserta el perfil del colaborador invitado", async () => {
      useTables({ profiles: [{}] });
      const profile = {
        id: PROFILE_ID,
        salon_id: SALON_ID,
        full_name: "Ana Lopez",
        is_owner: false,
        role_id: null,
      };

      await expect(insertEmployeeProfile(profile)).resolves.toEqual({ error: null });

      expect(db.argsOf("profiles", "insert")).toEqual([profile]);
    });

    it("devuelve el error de inserción", async () => {
      useTables({ profiles: [{ error: { message: "duplicado" } }] });

      await expect(
        insertEmployeeProfile({
          id: PROFILE_ID,
          salon_id: SALON_ID,
          full_name: "x",
          is_owner: false,
          role_id: null,
        })
      ).resolves.toEqual({ error: { message: "duplicado" } });
    });
  });

  describe("linkEmployeeProfile", () => {
    it("vincula el perfil al empleado acotando por salón", async () => {
      useTables({ employees: [{}] });

      await linkEmployeeProfile(EMPLOYEE_ID, SALON_ID, PROFILE_ID);

      expect(db.argsOf("employees", "update")).toEqual([{ profile_id: PROFILE_ID }]);
      expect(db.callsFor("employees").filter((call) => call.method === "eq")).toEqual([
        { table: "employees", method: "eq", args: ["id", EMPLOYEE_ID] },
        { table: "employees", method: "eq", args: ["salon_id", SALON_ID] },
      ]);
    });

    it("devuelve el error de vinculación", async () => {
      useTables({ employees: [{ error: { message: "sin cambios" } }] });

      await expect(linkEmployeeProfile(EMPLOYEE_ID, SALON_ID, PROFILE_ID)).resolves.toEqual({
        error: { message: "sin cambios" },
      });
    });
  });
});
