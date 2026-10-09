import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  createManualReminderLog,
  findLatestReminderLogsByAppointmentIds,
  findManualReminderSentAt,
  ReminderLogDuplicateError,
} from "./reminder-log.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";
const KEY = "5f1c2a3e-8b7d-4c6e-9a0b-1d2e3f4a5b6c";

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("reminder-log.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("findLatestReminderLogsByAppointmentIds", () => {
    it("no consulta la BD cuando no hay citas", async () => {
      const db = useDb();

      expect(await findLatestReminderLogsByAppointmentIds(SALON_ID, [])).toEqual(new Map());
      expect(db.operations).toEqual([]);
    });

    it("conserva solo el recordatorio mas reciente por cita, filtrando por salon", async () => {
      const db = useDb({
        appointment_reminder_log: {
          data: [
            { appointment_id: "a1", sent_at: "2026-06-12T10:00:00.000Z", channel: "whatsapp" },
            { appointment_id: "a1", sent_at: "2026-06-10T10:00:00.000Z", channel: "whatsapp" },
            { appointment_id: "a2", sent_at: "2026-06-11T08:00:00.000Z", channel: "email" },
          ],
          error: null,
        },
      });

      const latest = await findLatestReminderLogsByAppointmentIds(SALON_ID, ["a1", "a2"]);

      expect(latest.get("a1")).toEqual({
        appointment_id: "a1",
        sent_at: "2026-06-12T10:00:00.000Z",
        channel: "whatsapp",
      });
      expect(latest.get("a2")?.channel).toBe("email");
      expect(latest.size).toBe(2);
      expect(operationsOn(db, "appointment_reminder_log")).toEqual([
        { target: "appointment_reminder_log", method: "select", args: ["appointment_id, sent_at, channel"] },
        { target: "appointment_reminder_log", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "appointment_reminder_log", method: "in", args: ["appointment_id", ["a1", "a2"]] },
        { target: "appointment_reminder_log", method: "order", args: ["sent_at", { ascending: false }] },
      ]);
    });

    it("devuelve un mapa vacio cuando la BD no devuelve filas", async () => {
      useDb({ appointment_reminder_log: { data: null, error: null } });

      expect(await findLatestReminderLogsByAppointmentIds(SALON_ID, ["a1"])).toEqual(new Map());
    });

    it("propaga el error de la consulta", async () => {
      const dbError = { message: "fallo" };
      useDb({ appointment_reminder_log: { data: null, error: dbError } });

      await expect(findLatestReminderLogsByAppointmentIds(SALON_ID, ["a1"])).rejects.toBe(dbError);
    });
  });

  describe("createManualReminderLog", () => {
    it("registra un recordatorio manual por WhatsApp y devuelve la fecha de envio", async () => {
      const db = useDb({
        appointment_reminder_log: { data: { sent_at: "2026-06-12T10:00:00.000Z" }, error: null },
      });

      expect(
        await createManualReminderLog({
          salonId: SALON_ID,
          appointmentId: "a1",
          templateId: "tpl-1",
          recipientPhone: "+50761234567",
          userId: "user-1",
          idempotencyKey: KEY,
        })
      ).toBe("2026-06-12T10:00:00.000Z");
      expect(operationsOn(db, "appointment_reminder_log")).toEqual([
        {
          target: "appointment_reminder_log",
          method: "insert",
          args: [
            {
              salon_id: SALON_ID,
              appointment_id: "a1",
              template_id: "tpl-1",
              channel: "whatsapp",
              recipient_phone: "+50761234567",
              created_by: "user-1",
              idempotency_key: KEY,
            },
          ],
        },
        { target: "appointment_reminder_log", method: "select", args: ["sent_at"] },
        { target: "appointment_reminder_log", method: "single", args: [] },
      ]);
    });

    it("usa nulos para plantilla y telefono cuando no se indican", async () => {
      const db = useDb({ appointment_reminder_log: { data: { sent_at: "2026-06-12T10:00:00.000Z" }, error: null } });

      await createManualReminderLog({ salonId: SALON_ID, appointmentId: "a1", userId: "user-1", idempotencyKey: KEY });

      expect(operationsOn(db, "appointment_reminder_log")[0]?.args[0]).toMatchObject({
        template_id: null,
        recipient_phone: null,
      });
    });

    it("propaga el error de insercion", async () => {
      const dbError = { message: "fallo" };
      useDb({ appointment_reminder_log: { data: null, error: dbError } });

      await expect(
        createManualReminderLog({ salonId: SALON_ID, appointmentId: "a1", userId: "user-1", idempotencyKey: KEY })
      ).rejects.toBe(dbError);
    });

    it("convierte la violacion del indice de idempotencia (23505) en ReminderLogDuplicateError", async () => {
      useDb({ appointment_reminder_log: { data: null, error: { code: "23505", message: "duplicate" } } });

      await expect(
        createManualReminderLog({ salonId: SALON_ID, appointmentId: "a1", userId: "user-1", idempotencyKey: KEY })
      ).rejects.toBeInstanceOf(ReminderLogDuplicateError);
    });
  });

  describe("findManualReminderSentAt", () => {
    it("busca el registro por salon, cita y clave de idempotencia", async () => {
      const db = useDb({
        appointment_reminder_log: { data: { sent_at: "2026-06-12T10:00:00.000Z" }, error: null },
      });

      expect(await findManualReminderSentAt({ salonId: SALON_ID, appointmentId: "a1", idempotencyKey: KEY })).toBe(
        "2026-06-12T10:00:00.000Z"
      );
      expect(operationsOn(db, "appointment_reminder_log").map((op) => op.method)).toEqual([
        "select",
        "eq",
        "eq",
        "eq",
        "maybeSingle",
      ]);
    });

    it("devuelve null cuando no existe registro con esa clave", async () => {
      useDb({ appointment_reminder_log: { data: null, error: null } });

      expect(await findManualReminderSentAt({ salonId: SALON_ID, appointmentId: "a1", idempotencyKey: KEY })).toBeNull();
    });
  });
});
