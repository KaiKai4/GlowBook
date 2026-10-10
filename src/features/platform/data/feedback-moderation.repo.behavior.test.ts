import { beforeEach, describe, expect, it, vi } from "vitest";
import { findFeedbackReports, setFeedbackStatus } from "./feedback-moderation.repo";
import {
  argsOf,
  createFakeSupabase,
  queryFor,
  type FakeSupabase,
} from "@/test/platform-feedback-notifications-supabase";

// Moderacion de feedback desde la plataforma (cliente admin, cross-tenant):
// la lectura trae salon y autor embebidos y la escritura solo cambia el estado.

const clients = vi.hoisted(() => ({ admin: null as FakeSupabase | null }));

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: () => clients.admin,
}));

const REPORT_ID = "00000000-0000-4000-8000-0000000000cc";

beforeEach(() => {
  clients.admin = null;
});

describe("findFeedbackReports", () => {
  it("reads reports newest first with the salón and reporter embedded", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await findFeedbackReports();

    const query = queryFor(admin, "feedback_reports");
    expect(argsOf(query, "select")).toEqual([
      ["id, category, message, status, created_at, salon:salons(name), reporter:profiles(full_name)"],
    ]);
    expect(argsOf(query, "order")).toEqual([["created_at", { ascending: false }]]);
  });

  it("returns the embedded rows as they come back", async () => {
    const rows = [
      {
        id: REPORT_ID,
        category: "bug",
        message: "La agenda no carga",
        status: "new",
        created_at: "2026-06-01T10:00:00.000Z",
        salon: { name: "Glow" },
        reporter: { full_name: "Ana" },
      },
    ];
    clients.admin = createFakeSupabase({ tables: { feedback_reports: { data: rows, error: null } } });

    await expect(findFeedbackReports()).resolves.toEqual(rows);
  });

  it("keeps reports whose salón or reporter was removed as null embeds", async () => {
    const rows = [
      {
        id: REPORT_ID,
        category: "other",
        message: "Sin salón",
        status: "new",
        created_at: "2026-06-01T10:00:00.000Z",
        salon: null,
        reporter: null,
      },
    ];
    clients.admin = createFakeSupabase({ tables: { feedback_reports: { data: rows, error: null } } });

    await expect(findFeedbackReports()).resolves.toEqual(rows);
  });

  it("returns an empty list on null data and throws on errors", async () => {
    clients.admin = createFakeSupabase({ tables: { feedback_reports: { data: null, error: null } } });
    await expect(findFeedbackReports()).resolves.toEqual([]);

    const readError = { message: "denied" };
    clients.admin = createFakeSupabase({ tables: { feedback_reports: { data: null, error: readError } } });
    await expect(findFeedbackReports()).rejects.toBe(readError);
  });
});

describe("setFeedbackStatus", () => {
  it("updates the status of exactly the report with that id", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await setFeedbackStatus(REPORT_ID, "resolved");

    const query = queryFor(admin, "feedback_reports");
    expect(argsOf(query, "update")).toEqual([[{ status: "resolved" }]]);
    expect(argsOf(query, "eq")).toEqual([["id", REPORT_ID]]);
  });

  it("can reopen a report by setting it back to new", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    await setFeedbackStatus(REPORT_ID, "new");

    expect(argsOf(queryFor(admin, "feedback_reports"), "update")).toEqual([[{ status: "new" }]]);
  });

  it("throws update errors", async () => {
    const updateError = { message: "denied" };
    clients.admin = createFakeSupabase({
      tables: { feedback_reports: { data: null, error: updateError } },
    });

    await expect(setFeedbackStatus(REPORT_ID, "resolved")).rejects.toBe(updateError);
  });
});
