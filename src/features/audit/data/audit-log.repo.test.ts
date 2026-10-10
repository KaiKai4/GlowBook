import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordAuditLogEntry } from "./audit-log.repo";
import {
  argsOf,
  createFakeSupabase,
  queryFor,
  type FakeSupabase,
} from "@/test/platform-feedback-notifications-supabase";

// Bitacora de plataforma: cada accion del super-admin deja una fila con actor,
// objetivo y estado. La escritura normaliza el JSON de metadata.

const clients = vi.hoisted(() => ({ admin: null as FakeSupabase | null }));

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: () => clients.admin,
}));

const ACTOR_ID = "00000000-0000-4000-8000-000000000001";
const SALON_ID = "00000000-0000-4000-8000-000000000002";

const EMPTY_ENTRY = {
  actorUserId: ACTOR_ID,
  action: "invite_salon" as const,
  status: "succeeded" as const,
  targetSalonId: null,
  targetResourceType: null,
  targetResourceId: null,
  metadata: {},
  errorMessage: null,
};

beforeEach(() => {
  clients.admin = null;
});

describe("recordAuditLogEntry", () => {
  it("inserts the audit row with explicit nulls for omitted target and error fields", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await recordAuditLogEntry(EMPTY_ENTRY);

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

    await recordAuditLogEntry({
      actorUserId: null,
      action: "set_salon_status",
      status: "failed",
      targetSalonId: SALON_ID,
      targetResourceType: "salon",
      targetResourceId: SALON_ID,
      metadata: { isActive: false, note: "suspendido" },
      errorMessage: "Salón no encontrado.",
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
          error_message: "Salón no encontrado.",
        },
      ],
    ]);
  });

  it("drops undefined metadata values so the JSON column only receives serialisable data", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await recordAuditLogEntry({
      ...EMPTY_ENTRY,
      action: "delete_salon",
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

    await expect(recordAuditLogEntry({ ...EMPTY_ENTRY, action: "delete_salon" })).rejects.toBe(insertError);
  });
});
