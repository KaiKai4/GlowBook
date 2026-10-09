import { beforeEach, describe, expect, it, vi } from "vitest";
import { findPlatformAuditLog } from "./platform-audit.repo";
import {
  argsOf,
  createFakeSupabase,
  queryFor,
  type FakeSupabase,
} from "@/test/platform-feedback-notifications-supabase";

// Lectura de la auditoria de plataforma: acota el numero de filas y solo filtra
// por las columnas indicadas. La escritura la cubre el modulo audit.

const clients = vi.hoisted(() => ({ admin: null as FakeSupabase | null }));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => clients.admin,
}));

beforeEach(() => {
  clients.admin = null;
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
