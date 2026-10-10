import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashInvitationToken } from "@/infra/auth/invitation-tokens";
import { createFakeSupabase, type FakeDbResponse, type FakeSupabase, type FakeSupabaseClient } from "@/test/access-employees-supabase-fake";
import { deleteEmployeeInvitations, deletePendingEmployeeInvitations, findEmployeeInvitationForJoin, findLatestPendingEmployeeInvitationRole, insertEmployeeInvitation, markEmployeeInvitationAccepted, findLatestEmployeeInvitation } from "./employee-invitations.repo";

const serverHolder = vi.hoisted(() => ({ current: null as FakeSupabaseClient | null }));

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverHolder.current,
}));

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
let db: FakeSupabase;

function useServerTables(responses: Record<string, FakeDbResponse[]>) {
  db = createFakeSupabase(responses);
  serverHolder.current = db.client;
}

function eqCalls(table: string): unknown[][] {
  return db
    .callsFor(table)
    .filter((call) => call.method === "eq")
    .map((call) => call.args);
}

describe("employee invitations repo", () => {
  beforeEach(() => {
    adminHolder.current = null;
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
        salons: { name: "Salón Sol" },
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

  describe("markEmployeeInvitationAccepted", () => {
    it("marca la invitación como aceptada con una fecha ISO", async () => {
      useTables({ employee_invitations: [{}] });

      await expect(markEmployeeInvitationAccepted("inv-1", SALON_ID)).resolves.toEqual({ error: null });

      const [update] = db.argsOf("employee_invitations", "update") ?? [];
      const acceptedAt = (update as { accepted_at: string }).accepted_at;
      expect(Number.isNaN(Date.parse(acceptedAt))).toBe(false);
      const eqArgs = db
        .callsFor("employee_invitations")
        .filter((call) => call.method === "eq")
        .map((call) => call.args);
      expect(eqArgs).toEqual([
        ["id", "inv-1"],
        ["salon_id", SALON_ID],
      ]);
    });

    it("devuelve el error de actualización", async () => {
      useTables({ employee_invitations: [{ error: { message: "sin efecto" } }] });

      await expect(markEmployeeInvitationAccepted("inv-1", SALON_ID)).resolves.toEqual({
        error: { message: "sin efecto" },
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
      useServerTables({ employee_invitations: [{ data: row }] });

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
      useServerTables({ employee_invitations: [{ data: null }] });

      await expect(findLatestEmployeeInvitation(EMPLOYEE_ID, SALON_ID)).resolves.toBeNull();
    });

    it("propaga el error de la consulta en vez de devolver null", async () => {
      useServerTables({ employee_invitations: [{ error: { message: "caido" } }] });

      await expect(findLatestEmployeeInvitation(EMPLOYEE_ID, SALON_ID)).rejects.toEqual({ message: "caido" });
    });
  });
});
