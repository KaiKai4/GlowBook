import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFeedbackReport } from "./feedback.repo";
import {
  argsOf,
  createFakeSupabase,
  queryFor,
  type FakeSupabase,
} from "@/test/platform-feedback-notifications-supabase";

// Escritura desde el salón: el cliente de sesion inserta el reporte con el
// salon y el autor indicados; RLS es quien garantiza que coincidan con el
// usuario autenticado, aquí solo fijamos las columnas enviadas.

const clients = vi.hoisted(() => ({ server: null as FakeSupabase | null }));

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => clients.server,
}));

const SALON_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  clients.server = null;
});

describe("createFeedbackReport", () => {
  it("inserts the report with the salón, author, category and message", async () => {
    const server = createFakeSupabase();
    clients.server = server;

    await createFeedbackReport({
      salonId: SALON_ID,
      createdBy: USER_ID,
      category: "suggestion",
      message: "Agregar recordatorios por correo",
    });

    expect(argsOf(queryFor(server, "feedback_reports"), "insert")).toEqual([
      [
        {
          salon_id: SALON_ID,
          created_by: USER_ID,
          category: "suggestion",
          message: "Agregar recordatorios por correo",
        },
      ],
    ]);
  });

  it("throws when the insert is rejected, so the use case can answer with a business error", async () => {
    const insertError = { message: "row level security" };
    clients.server = createFakeSupabase({
      tables: { feedback_reports: { data: null, error: insertError } },
    });

    await expect(
      createFeedbackReport({
        salonId: SALON_ID,
        createdBy: USER_ID,
        category: "bug",
        message: "No abre la agenda",
      })
    ).rejects.toBe(insertError);
  });
});
