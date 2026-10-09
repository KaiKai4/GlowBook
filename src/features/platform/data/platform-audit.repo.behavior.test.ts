import { beforeEach, describe, expect, it, vi } from "vitest";
import { findPlatformAuditLog, recordPlatformAudit } from "./platform-audit.repo";
import {
  argsOf,
  createFakeSupabase,
  queryFor,
  type FakeSupabase,
} from "@/test/platform-feedback-notifications-supabase";

// Auditoria de plataforma: cada accion del super-admin deja una fila con
// actor, objetivo y estado. La lectura acota el numero de filas y solo filtra
// por las columnas indicadas.

const clients = vi.hoisted(() => ({ admin: null as FakeSupabase | null }));

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: () => clients.admin,
}));

const ACTOR_ID = "00000000-0000-4000-8000-000000000001";
const SALON_ID = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  clients.admin = null;
});

describe("recordPlatformAudit", () => {
  it("inserts the audit row with explicit nulls for omitted target and error fields", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await recordPlatformAudit({
      actorUserId: ACTOR_ID,
      action: "invite_salon",
      status: "succeeded",
    });

    expect(argsOf(queryFor(admin, "platform_audit_log"), "insert")).toEqual([
      [
        {
          actor_user_id: ACTOR_ID,
          action: "invite_salon",
          status: "succeeded",
          target_salon_id: null,
          target_resource_type: null,
          target_resource_id: null,
          metadata: {},
          error_message: null,
        },
      ],
    ]);
  });

  it("stores the provided target, metadata and error message", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await recordPlatformAudit({
      actorUserId: null,
      action: "set_salon_status",
      status: "failed",
      targetSalonId: SALON_ID,
      targetResourceType: "salon",
      targetResourceId: SALON_ID,
      metadata: { isActive: false, note: "suspendido" },
      errorMessage: "Salon no encontrado.",
    });

    expect(argsOf(queryFor(admin, "platform_audit_log"), "insert")).toEqual([
      [
        {
          actor_user_id: null,
          action: "set_salon_status",
          status: "failed",
          target_salon_id: SALON_ID,
          target_resource_type: "salon",
          target_resource_id: SALON_ID,
          metadata: { isActive: false, note: "suspendido" },
          error_message: "Salon no encontrado.",
        },
      ],
    ]);
  });

  it("drops undefined metadata values so the JSON column only receives serialisable data", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await recordPlatformAudit({
      actorUserId: ACTOR_ID,
      action: "delete_salon",
      status: "succeeded",
      metadata: { kept: "si", dropped: undefined },
    });

    const [[row]] = argsOf(queryFor(admin, "platform_audit_log"), "insert") as [[{ metadata: unknown }]];
    expect(row.metadata).toEqual({ kept: "si" });
    expect(row.metadata).not.toHaveProperty("dropped");
  });

  it("throws when the insert fails so the caller can decide how to report it", async () => {
    const insertError = { message: "insert denied" };
    clients.admin = createFakeSupabase({
      tables: { platform_audit_log: { data: null, error: insertError } },
    });

    await expect(
      recordPlatformAudit({ actorUserId: ACTOR_ID, action: "delete_salon", status: "succeeded" })
    ).rejects.toBe(insertError);
  });
});

describe("findPlatformAuditLog", () => {
  it("reads the newest 100 rows by default and without any filter", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await findPlatformAuditLog();

    const query = queryFor(admin, "platform_audit_log");
    expect(argsOf(query, "order")).toEqual([["created_at", { ascending: false }]]);
    expect(argsOf(query, "limit")).toEqual([[100]]);
    expect(argsOf(query, "eq")).toEqual([]);
  });

  it("applies action and status filters as exact matches", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await findPlatformAuditLog({ action: "delete_salon", status: "failed" });

    const query = queryFor(admin, "platform_audit_log");
    expect(argsOf(query, "eq")).toEqual([
      ["action", "delete_salon"],
      ["status", "failed"],
    ]);
  });

  it("clamps the requested limit into the 1..200 range", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await findPlatformAuditLog({ limit: 0 });
    await findPlatformAuditLog({ limit: 5000 });
    await findPlatformAuditLog({ limit: 25 });

    const limits = admin.queries
      .filter((entry) => entry.table === "platform_audit_log")
      .map((entry) => argsOf(entry.query, "limit")[0]);
    expect(limits).toEqual([[1], [200], [25]]);
  });

  it("selects the columns the Platform view needs", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await findPlatformAuditLog();

    expect(argsOf(queryFor(admin, "platform_audit_log"), "select")).toEqual([
      [
        "id, actor_user_id, action, status, target_salon_id, target_resource_type, target_resource_id, metadata, error_message, created_at",
      ],
    ]);
  });

  it("returns an empty list when the adapter returns no data and throws on errors", async () => {
    clients.admin = createFakeSupabase({
      tables: { platform_audit_log: { data: null, error: null } },
    });
    await expect(findPlatformAuditLog()).resolves.toEqual([]);

    const readError = { message: "denied" };
    clients.admin = createFakeSupabase({
      tables: { platform_audit_log: { data: null, error: readError } },
    });
    await expect(findPlatformAuditLog()).rejects.toBe(readError);
  });
});
