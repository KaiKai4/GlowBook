import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashInvitationToken } from "@/lib/auth/invitation-tokens";
import {
  createFakeSupabase,
  type FakeDbResponse,
  type FakeSupabase,
  type FakeSupabaseClient,
} from "@/test/access-employees-supabase-fake";
import {
  deleteEmployeeInvitations,
  deletePendingEmployeeInvitations,
  findAssignableEmployeeRole,
  findEmployeeAccessProfile,
  findEmployeeInvitationForJoin,
  findLatestPendingEmployeeInvitationRole,
  insertEmployeeInvitation,
  insertEmployeeProfile,
  linkEmployeeProfile,
  markEmployeeInvitationAccepted,
  unlinkEmployeeProfile,
  updateEmployeeProfileRole,
} from "./employee-access.repo";

// Todas estas consultas usan el cliente admin (service_role), que salta la RLS.
// Por eso cada una debe filtrar explícitamente por salon_id cuando la tabla es
// multi-tenant, y nunca exponer el token en claro.

const adminHolder = vi.hoisted(() => ({ current: null as FakeSupabaseClient | null }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminHolder.current,
}));

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";
const PROFILE_ID = "profile-1";

let db: FakeSupabase;

function useTables(responses: Record<string, FakeDbResponse[]>) {
  db = createFakeSupabase(responses);
  adminHolder.current = db.client;
}

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

  describe("deletePendingEmployeeInvitations", () => {
    it("borra solo invitaciones no aceptadas del empleado dentro del salón", async () => {
      useTables({ employee_invitations: [{}] });

      await expect(deletePendingEmployeeInvitations(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        error: null,
      });

      expect(db.callsFor("employee_invitations").map((call) => [call.method, call.args])).toEqual([
        ["delete", []],
        ["eq", ["employee_id", EMPLOYEE_ID]],
        ["eq", ["salon_id", SALON_ID]],
        ["is", ["accepted_at", null]],
      ]);
    });

    it("devuelve el error sin lanzarlo", async () => {
      const error = { message: "fallo" };
      useTables({ employee_invitations: [{ error }] });

      await expect(deletePendingEmployeeInvitations(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        error,
      });
    });
  });

  describe("insertEmployeeInvitation", () => {
    const invitation = {
      employee_id: EMPLOYEE_ID,
      salon_id: SALON_ID,
      email: "ana@salon.test",
      role_id: null,
      token_hash: "hash",
      expires_at: "2026-10-16T00:00:00.000Z",
    };

    it("inserta la invitación tal cual con el hash del token", async () => {
      useTables({ employee_invitations: [{}] });

      await expect(insertEmployeeInvitation(invitation)).resolves.toEqual({ error: null });

      expect(db.argsOf("employee_invitations", "insert")).toEqual([invitation]);
    });

    it("devuelve el error de inserción", async () => {
      useTables({ employee_invitations: [{ error: { message: "rechazada" } }] });

      await expect(insertEmployeeInvitation(invitation)).resolves.toEqual({
        error: { message: "rechazada" },
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

  describe("deleteEmployeeInvitations", () => {
    it("borra todas las invitaciones del empleado dentro del salón, aceptadas o no", async () => {
      useTables({ employee_invitations: [{}] });

      await deleteEmployeeInvitations(EMPLOYEE_ID, SALON_ID);

      const methods = db.callsFor("employee_invitations").map((call) => call.method);
      expect(methods).toEqual(["delete", "eq", "eq"]);
      expect(db.callsFor("employee_invitations").map((call) => call.args)).toEqual([
        [],
        ["employee_id", EMPLOYEE_ID],
        ["salon_id", SALON_ID],
      ]);
    });

    it("devuelve el error de borrado", async () => {
      useTables({ employee_invitations: [{ error: { message: "no borrable" } }] });

      await expect(deleteEmployeeInvitations(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        error: { message: "no borrable" },
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

  describe("findLatestPendingEmployeeInvitationRole", () => {
    it("toma la invitación pendiente más reciente del empleado y salón", async () => {
      useTables({ employee_invitations: [{ data: { role_id: "role-3" } }] });

      await expect(
        findLatestPendingEmployeeInvitationRole(EMPLOYEE_ID, SALON_ID)
      ).resolves.toEqual({ data: { role_id: "role-3" }, error: null });

      expect(db.callsFor("employee_invitations").map((call) => [call.method, call.args])).toEqual([
        ["select", ["role_id"]],
        ["eq", ["employee_id", EMPLOYEE_ID]],
        ["eq", ["salon_id", SALON_ID]],
        ["is", ["accepted_at", null]],
        ["order", ["created_at", { ascending: false }]],
        ["limit", [1]],
        ["maybeSingle", []],
      ]);
    });
  });

  describe("findEmployeeInvitationForJoin", () => {
    it("busca por el hash del token y nunca envía el token en claro a la consulta", async () => {
      const token = "token-en-claro-de-prueba";
      useTables({ employee_invitations: [{ data: null }] });

      await findEmployeeInvitationForJoin(token);

      expect(db.argsOf("employee_invitations", "eq")).toEqual([
        "token_hash",
        hashInvitationToken(token),
      ]);
      const everyArg = db.calls.flatMap((call) => call.args);
      expect(everyArg).not.toContain(token);
    });

    it("devuelve la invitación con relaciones tal cual y propaga el error", async () => {
      const invitation = {
        id: "inv-1",
        employee_id: EMPLOYEE_ID,
        salon_id: SALON_ID,
        email: "ana@salon.test",
        role_id: null,
        expires_at: "2026-10-16T00:00:00.000Z",
        accepted_at: null,
        employees: { first_name: "Ana", last_name: "Lopez" },
        salons: { name: "Salon Sol" },
      };
      useTables({ employee_invitations: [{ data: invitation }] });

      await expect(findEmployeeInvitationForJoin("t")).resolves.toEqual({
        data: invitation,
        error: null,
      });

      useTables({ employee_invitations: [{ error: { message: "caido" } }] });
      await expect(findEmployeeInvitationForJoin("t")).resolves.toEqual({
        data: null,
        error: { message: "caido" },
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

  describe("markEmployeeInvitationAccepted", () => {
    it("marca la invitación como aceptada con una fecha ISO", async () => {
      useTables({ employee_invitations: [{}] });

      await expect(markEmployeeInvitationAccepted("inv-1")).resolves.toEqual({ error: null });

      const [update] = db.argsOf("employee_invitations", "update") ?? [];
      const acceptedAt = (update as { accepted_at: string }).accepted_at;
      expect(Number.isNaN(Date.parse(acceptedAt))).toBe(false);
      expect(db.argsOf("employee_invitations", "eq")).toEqual(["id", "inv-1"]);
    });

    it("devuelve el error de actualización", async () => {
      useTables({ employee_invitations: [{ error: { message: "sin efecto" } }] });

      await expect(markEmployeeInvitationAccepted("inv-1")).resolves.toEqual({
        error: { message: "sin efecto" },
      });
    });
  });
});
