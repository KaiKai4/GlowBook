import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MESSAGE_TEMPLATES } from "../domain/templates";
import {
  findActiveMessageTemplate,
  findMessageTemplates,
  upsertMessageTemplate,
} from "./notification-templates.repo";
import {
  argsOf,
  createFakeSupabase,
  queryFor,
  type FakeSupabase,
} from "@/test/platform-feedback-notifications-supabase";

// Plantillas de WhatsApp al cliente final. Todas las consultas acotan por el
// salon del contexto, por canal whatsapp y por destinatario cliente; cuando un
// salon no tiene plantilla propia se devuelve la plantilla por defecto.

const clients = vi.hoisted(() => ({ server: null as FakeSupabase | null }));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => clients.server,
}));

const SALON_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_SALON_ID = "00000000-0000-4000-8000-000000000009";

const customCancelled = {
  id: "tpl-cancel",
  event: "appointment_cancelled",
  name: "Cancelacion WhatsApp",
  body_text: "Hola {cliente}, tu cita fue cancelada.",
  is_active: false,
};

beforeEach(() => {
  clients.server = null;
});

describe("findMessageTemplates", () => {
  it("scopes the read to the salon, WhatsApp channel and customer recipient, in event order", async () => {
    const server = createFakeSupabase();
    clients.server = server;

    await findMessageTemplates(SALON_ID);

    const query = queryFor(server, "notification_templates");
    expect(argsOf(query, "eq")).toEqual([
      ["salon_id", SALON_ID],
      ["channel", "whatsapp"],
      ["recipient", "customer"],
    ]);
    expect(argsOf(query, "in")).toEqual([
      ["event", ["appointment_reminder", "appointment_cancelled"]],
    ]);
    expect(argsOf(query, "order")).toEqual([["event", { ascending: true }]]);
  });

  it("never reads another salon's templates when asked for one salon", async () => {
    const server = createFakeSupabase();
    clients.server = server;

    await findMessageTemplates(OTHER_SALON_ID);

    expect(argsOf(queryFor(server, "notification_templates"), "eq")[0]).toEqual([
      "salon_id",
      OTHER_SALON_ID,
    ]);
  });

  it("returns the salon's stored templates and fills missing events with defaults in fixed order", async () => {
    clients.server = createFakeSupabase({
      tables: { notification_templates: { data: [customCancelled], error: null } },
    });

    const templates = await findMessageTemplates(SALON_ID);

    expect(templates).toEqual([
      DEFAULT_MESSAGE_TEMPLATES.appointment_reminder,
      {
        id: "tpl-cancel",
        event: "appointment_cancelled",
        name: "Cancelacion WhatsApp",
        body_text: "Hola {cliente}, tu cita fue cancelada.",
        is_active: false,
      },
    ]);
  });

  it("returns both defaults when the salon has no stored templates", async () => {
    clients.server = createFakeSupabase({
      tables: { notification_templates: { data: null, error: null } },
    });

    await expect(findMessageTemplates(SALON_ID)).resolves.toEqual([
      DEFAULT_MESSAGE_TEMPLATES.appointment_reminder,
      DEFAULT_MESSAGE_TEMPLATES.appointment_cancelled,
    ]);
  });

  it("throws read errors", async () => {
    const readError = { message: "denied" };
    clients.server = createFakeSupabase({
      tables: { notification_templates: { data: null, error: readError } },
    });

    await expect(findMessageTemplates(SALON_ID)).rejects.toBe(readError);
  });
});

describe("findActiveMessageTemplate", () => {
  it("looks for the active WhatsApp customer template of that event, most recently edited first", async () => {
    const server = createFakeSupabase();
    clients.server = server;

    await findActiveMessageTemplate(SALON_ID, "appointment_reminder");

    const query = queryFor(server, "notification_templates");
    expect(argsOf(query, "eq")).toEqual([
      ["salon_id", SALON_ID],
      ["channel", "whatsapp"],
      ["recipient", "customer"],
      ["event", "appointment_reminder"],
      ["is_active", true],
    ]);
    expect(argsOf(query, "order")).toEqual([["updated_at", { ascending: false }]]);
    expect(argsOf(query, "limit")).toEqual([[1]]);
    expect(query.calls.at(-1)?.method).toBe("maybeSingle");
  });

  it("maps the stored active template with its id", async () => {
    clients.server = createFakeSupabase({
      tables: {
        notification_templates: {
          data: { ...customCancelled, id: "tpl-1", event: "appointment_reminder", is_active: true },
          error: null,
        },
      },
    });

    await expect(findActiveMessageTemplate(SALON_ID, "appointment_reminder")).resolves.toEqual({
      id: "tpl-1",
      event: "appointment_reminder",
      name: "Cancelacion WhatsApp",
      body_text: "Hola {cliente}, tu cita fue cancelada.",
      is_active: true,
    });
  });

  it("falls back to the default template when no active one exists", async () => {
    clients.server = createFakeSupabase({
      tables: { notification_templates: { data: null, error: null } },
    });

    await expect(findActiveMessageTemplate(SALON_ID, "appointment_cancelled")).resolves.toEqual(
      DEFAULT_MESSAGE_TEMPLATES.appointment_cancelled
    );
  });

  it("throws read errors instead of silently sending the default message", async () => {
    const readError = { message: "denied" };
    clients.server = createFakeSupabase({
      tables: { notification_templates: { data: null, error: readError } },
    });

    await expect(findActiveMessageTemplate(SALON_ID, "appointment_reminder")).rejects.toBe(readError);
  });
});

describe("upsertMessageTemplate", () => {
  it("writes the template with the default name and fixed channel and recipient, upserting on the unique key", async () => {
    const server = createFakeSupabase();
    clients.server = server;

    await upsertMessageTemplate(SALON_ID, {
      event: "appointment_cancelled",
      name: "ignorado: el nombre se toma del catalogo",
      body_text: "Tu cita del {fecha} fue cancelada.",
      is_active: true,
    });

    expect(argsOf(queryFor(server, "notification_templates"), "upsert")).toEqual([
      [
        {
          salon_id: SALON_ID,
          channel: "whatsapp",
          event: "appointment_cancelled",
          recipient: "customer",
          name: DEFAULT_MESSAGE_TEMPLATES.appointment_cancelled.name,
          subject: "",
          body_text: "Tu cita del {fecha} fue cancelada.",
          body_html: "",
          is_active: true,
        },
        { onConflict: "salon_id,channel,event,name" },
      ],
    ]);
  });

  it("persists a deactivated template as inactive", async () => {
    const server = createFakeSupabase();
    clients.server = server;

    await upsertMessageTemplate(SALON_ID, {
      event: "appointment_reminder",
      name: "x",
      body_text: "Hola {cliente}, recordatorio.",
      is_active: false,
    });

    const [[payload]] = argsOf(queryFor(server, "notification_templates"), "upsert") as [
      [{ is_active: boolean }],
    ];
    expect(payload.is_active).toBe(false);
  });

  it("throws write errors", async () => {
    const writeError = { message: "denied" };
    clients.server = createFakeSupabase({
      tables: { notification_templates: { data: null, error: writeError } },
    });

    await expect(
      upsertMessageTemplate(SALON_ID, {
        event: "appointment_reminder",
        name: "x",
        body_text: "Hola {cliente}, recordatorio.",
        is_active: true,
      })
    ).rejects.toBe(writeError);
  });
});
