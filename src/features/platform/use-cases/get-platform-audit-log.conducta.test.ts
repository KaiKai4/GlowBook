import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findPlatformAuditLog,
  type PlatformAuditRow,
} from "@/features/platform/data/platform-audit.repo";
import { getPlatformAuditLog } from "./get-platform-audit-log";
import { firstOf } from "@/test/platform-feedback-notifications-helpers";

// Vista de auditoria: los filtros desconocidos no llegan a la consulta, las
// metadatas se convierten en pares legibles y los ids se acortan para no
// exponer identificadores completos en la tabla.

vi.mock("@/features/platform/data/platform-audit.repo", () => ({
  findPlatformAuditLog: vi.fn(),
}));

const mockedFind = vi.mocked(findPlatformAuditLog);

const ACTOR_ID = "aaaaaaaa-1111-4111-8111-000000000001";
const SALON_ID = "11111111-2222-4111-8111-111111111111";
const RESOURCE_ID = "22222222-3333-4111-8111-222222222222";

function row(overrides: Partial<PlatformAuditRow> = {}): PlatformAuditRow {
  return {
    id: "audit-1",
    actor_user_id: ACTOR_ID,
    action: "set_salon_status",
    status: "succeeded",
    target_salon_id: null,
    target_resource_type: null,
    target_resource_id: null,
    metadata: {},
    error_message: null,
    created_at: "2026-06-15T15:30:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedFind.mockResolvedValue([]);
});

describe("getPlatformAuditLog filters", () => {
  it("queries the latest 100 entries with no action or status filter by default", async () => {
    await getPlatformAuditLog();

    expect(mockedFind).toHaveBeenCalledWith({ action: undefined, status: undefined, limit: 100 });
  });

  it("forwards known action and status filters to the adapter and echoes them back", async () => {
    mockedFind.mockResolvedValue([row({ status: "failed" })]);

    const view = await getPlatformAuditLog({ action: "delete_salon", status: "failed" });

    expect(mockedFind).toHaveBeenCalledWith({ action: "delete_salon", status: "failed", limit: 100 });
    expect(view.action).toBe("delete_salon");
    expect(view.status).toBe("failed");
  });

  it("drops unknown action and status values instead of passing them to the query", async () => {
    const view = await getPlatformAuditLog({ action: "drop_table", status: "pending" });

    expect(mockedFind).toHaveBeenCalledWith({ action: undefined, status: undefined, limit: 100 });
    expect(view.action).toBe("all");
    expect(view.status).toBe("all");
  });

  it("rejects inherited Object keys such as 'toString' as audit actions", async () => {
    // Antes el chequeo usaba el operador `in`, que también ve Object.prototype.
    const view = await getPlatformAuditLog({ action: "toString" });

    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ action: undefined }));
    expect(view.action).toBe("all");
  });

  it("offers every action label plus 'all', and the two statuses", async () => {
    const view = await getPlatformAuditLog();

    expect(view.actions[0]).toEqual({ value: "all", label: "Todas" });
    expect(view.actions).toContainEqual({ value: "invitation_accepted", label: "Invitación aceptada" });
    expect(view.actions).toContainEqual({ value: "delete_salon", label: "Eliminar Salón" });
    expect(view.statuses).toEqual([
      { value: "all", label: "Todos" },
      { value: "succeeded", label: "Correcta" },
      { value: "failed", label: "Fallida" },
    ]);
  });
});

describe("getPlatformAuditLog entries", () => {
  it("labels the action and status and shortens the actor id", async () => {
    mockedFind.mockResolvedValue([row()]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.actionLabel).toBe("Actualizar estado de Salón");
    expect(entry.statusLabel).toBe("Correcta");
    expect(entry.actorLabel).toBe("Admin aaaaaaaa");
  });

  it("shows a deleted admin when the actor reference is gone", async () => {
    mockedFind.mockResolvedValue([row({ actor_user_id: null })]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.actorLabel).toBe("Admin eliminado");
  });

  it("uses a generic action text and the raw status when they are not in the catalogue", async () => {
    mockedFind.mockResolvedValue([row({ action: "legacy_action", status: "queued" })]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.actionLabel).toBe("Acción no reconocida");
    expect(entry.statusLabel).toBe("queued");
  });

  it("derives the action text from the action key, so legacy text stored in metadata does not replace it", async () => {
    mockedFind.mockResolvedValue([row({ action: "invite_salon", metadata: { message: "Texto antiguo" } })]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.actionLabel).toBe("Invitar Salón");
    expect(entry.metadata).toEqual([{ key: "message", value: "Texto antiguo" }]);
  });

  it("does not treat prototype keys as known actions", async () => {
    mockedFind.mockResolvedValue([row({ action: "toString" })]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.actionLabel).toBe("Acción no reconocida");
  });

  it("describes the target as the salón when one is set, even if a resource is also set", async () => {
    mockedFind.mockResolvedValue([
      row({ target_salon_id: SALON_ID, target_resource_type: "salon_invitation", target_resource_id: RESOURCE_ID }),
    ]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.targetLabel).toBe("Salón 11111111");
  });

  it("describes a resource target by its type and short id", async () => {
    mockedFind.mockResolvedValue([
      row({ target_resource_type: "feedback_report", target_resource_id: RESOURCE_ID }),
    ]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.targetLabel).toBe("feedback_report 22222222");
  });

  it("shows only the resource type when no resource id was recorded", async () => {
    mockedFind.mockResolvedValue([row({ target_resource_type: "salon_invitation" })]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.targetLabel).toBe("salon_invitation");
  });

  it("marks entries without any target as having no target", async () => {
    mockedFind.mockResolvedValue([row()]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.targetLabel).toBe("Sin objetivo");
  });

  it("passes the error message through and keeps null when there is none", async () => {
    mockedFind.mockResolvedValue([
      row({ id: "a", status: "failed", error_message: "Auth cleanup failed" }),
      row({ id: "b" }),
    ]);

    const view = await getPlatformAuditLog();

    expect(view.entries.map((entry) => entry.errorMessage)).toEqual(["Auth cleanup failed", null]);
  });

  it("formats the creation time into a readable Spanish label that keeps the year", async () => {
    mockedFind.mockResolvedValue([row()]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.createdAtLabel).toMatch(/2026/);
    expect(entry.createdAtLabel.length).toBeGreaterThan(4);
  });
});

describe("getPlatformAuditLog metadata rendering", () => {
  it("turns each metadata value into text, joining arrays and serialising objects", async () => {
    mockedFind.mockResolvedValue([
      row({
        metadata: {
          name: "Glow",
          count: 2,
          active: true,
          tags: ["vip", "nuevo"],
          mixed: [null, 1],
          nested: { plan: "pro" },
        },
      }),
    ]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.metadata).toEqual([
      { key: "name", value: "Glow" },
      { key: "count", value: "2" },
      { key: "active", value: "true" },
      { key: "tags", value: "vip, nuevo" },
      { key: "mixed", value: "null, 1" },
      { key: "nested", value: '{"plan":"pro"}' },
    ]);
  });

  it("hides empty and null metadata values", async () => {
    mockedFind.mockResolvedValue([
      row({ metadata: { empty: "", missing: null, kept: "si" } }),
    ]);

    const entry = firstOf((await getPlatformAuditLog()).entries);

    expect(entry.metadata).toEqual([{ key: "kept", value: "si" }]);
  });

  it("returns no metadata items when the stored metadata is not an object", async () => {
    mockedFind.mockResolvedValue([row({ metadata: ["no", "objeto"] }), row({ id: "b", metadata: "texto" })]);

    const view = await getPlatformAuditLog();

    expect(view.entries.map((entry) => entry.metadata)).toEqual([[], []]);
  });
});

describe("getPlatformAuditLog summary", () => {
  it("counts visible and failed entries", async () => {
    mockedFind.mockResolvedValue([
      row({ id: "1", status: "failed" }),
      row({ id: "2", status: "succeeded" }),
      row({ id: "3", status: "failed" }),
    ]);

    const view = await getPlatformAuditLog();

    expect(view.totalVisible).toBe(3);
    expect(view.failedCount).toBe(2);
  });

  it("reports zero counts for an empty log", async () => {
    const view = await getPlatformAuditLog();

    expect(view.entries).toEqual([]);
    expect(view.totalVisible).toBe(0);
    expect(view.failedCount).toBe(0);
  });
});
