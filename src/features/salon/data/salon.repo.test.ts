import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  findAppointmentSalonConfig,
  findBusinessHours,
  findDashboardShellSalon,
  findSalonIdentity,
  findSalonSettings,
  updateSalonBackground,
  updateSalonName,
  updateSalonPaymentMethods,
  updateSalonTheme,
  upsertBusinessHours,
} from "./salon.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

// Error que la BD devuelve cuando la columna payment_methods aun no existe.
const MISSING_PAYMENT_COLUMN = { code: "42703", message: 'column "payment_methods" does not exist' };

describe("salon.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("findSalonSettings", () => {
    it("devuelve los ajustes del salon filtrando por id", async () => {
      const settings = {
        id: SALON_ID,
        name: "Glow",
        timezone: "America/Panama",
        theme: "rose",
        bg_style: null,
        payment_methods: ["cash"],
      };
      const db = useDb({ salons: { data: settings, error: null } });

      expect(await findSalonSettings(SALON_ID)).toEqual(settings);
      expect(operationsOn(db, "salons")).toEqual([
        { target: "salons", method: "select", args: ["id, name, timezone, theme, bg_style, payment_methods"] },
        { target: "salons", method: "eq", args: ["id", SALON_ID] },
        { target: "salons", method: "single", args: [] },
      ]);
    });

    it("cae a la consulta sin payment_methods y asigna lista vacia si la columna no existe", async () => {
      const db = useDb({
        salons: [
          { data: null, error: MISSING_PAYMENT_COLUMN },
          { data: { id: SALON_ID, name: "Glow", timezone: "UTC", theme: "rose", bg_style: null }, error: null },
        ],
      });

      expect(await findSalonSettings(SALON_ID)).toEqual({
        id: SALON_ID,
        name: "Glow",
        timezone: "UTC",
        theme: "rose",
        bg_style: null,
        payment_methods: [],
      });
      expect(operationsOn(db, "salons")[0]?.args).toEqual([
        "id, name, timezone, theme, bg_style, payment_methods",
      ]);
      expect(operationsOn(db, "salons")[3]?.args).toEqual(["id, name, timezone, theme, bg_style"]);
    });

    it("devuelve null si el salon no existe en la consulta de fallback", async () => {
      useDb({ salons: [{ data: null, error: MISSING_PAYMENT_COLUMN }, { data: null, error: null }] });

      expect(await findSalonSettings(SALON_ID)).toBeNull();
    });

    it("propaga errores de la fallback y errores distintos a columna ausente", async () => {
      const fallbackError = { message: "fallo" };
      useDb({ salons: [{ data: null, error: MISSING_PAYMENT_COLUMN }, { data: null, error: fallbackError }] });
      await expect(findSalonSettings(SALON_ID)).rejects.toBe(fallbackError);

      const otherError = { code: "XX000", message: "otro" };
      useDb({ salons: { data: null, error: otherError } });
      await expect(findSalonSettings(SALON_ID)).rejects.toBe(otherError);
    });

    it("devuelve null cuando la consulta no trae fila y no hay error", async () => {
      useDb({ salons: { data: null, error: null } });

      expect(await findSalonSettings(SALON_ID)).toBeNull();
    });
  });

  describe("findSalonIdentity", () => {
    it("devuelve nombre, zona horaria y metodos de pago", async () => {
      useDb({ salons: { data: { name: "Glow", timezone: "UTC", payment_methods: ["card"] }, error: null } });

      expect(await findSalonIdentity(SALON_ID)).toEqual({
        name: "Glow",
        timezone: "UTC",
        payment_methods: ["card"],
      });
    });

    it("cae a la consulta sin payment_methods cuando la columna no existe", async () => {
      useDb({
        salons: [
          { data: null, error: MISSING_PAYMENT_COLUMN },
          { data: { name: "Glow", timezone: "UTC" }, error: null },
        ],
      });

      expect(await findSalonIdentity(SALON_ID)).toEqual({ name: "Glow", timezone: "UTC", payment_methods: [] });
    });

    it("devuelve null sin fila y propaga errores de la consulta de fallback", async () => {
      useDb({ salons: { data: null, error: null } });
      expect(await findSalonIdentity(SALON_ID)).toBeNull();

      const fallbackError = { message: "fallo" };
      useDb({ salons: [{ data: null, error: MISSING_PAYMENT_COLUMN }, { data: null, error: fallbackError }] });
      await expect(findSalonIdentity(SALON_ID)).rejects.toBe(fallbackError);

      useDb({ salons: [{ data: null, error: MISSING_PAYMENT_COLUMN }, { data: null, error: null }] });
      expect(await findSalonIdentity(SALON_ID)).toBeNull();

      const otherError = { message: "otro" };
      useDb({ salons: { data: null, error: otherError } });
      await expect(findSalonIdentity(SALON_ID)).rejects.toBe(otherError);
    });
  });

  describe("findDashboardShellSalon / findAppointmentSalonConfig", () => {
    it("devuelve el salon para el shell del dashboard o null si no hay fila", async () => {
      const shell = {
        name: "Glow",
        is_active: true,
        theme: "rose",
        bg_style: null,
        disabled_features: ["reports"],
      };
      const db = useDb({ salons: { data: shell, error: null } });

      expect(await findDashboardShellSalon(SALON_ID)).toEqual(shell);
      expect(operationsOn(db, "salons")).toContainEqual({ target: "salons", method: "eq", args: ["id", SALON_ID] });

      useDb({ salons: { data: null, error: null } });
      expect(await findDashboardShellSalon(SALON_ID)).toBeNull();

      useDb({ salons: { data: null, error: { message: "caido" } } });
      await expect(findDashboardShellSalon(SALON_ID)).rejects.toEqual({ message: "caido" });
    });

    it("devuelve la configuracion de agenda del salon o null", async () => {
      const config = {
        min_booking_notice_minutes: 60,
        min_appointment_duration_minutes: 15,
        allow_off_hours_bookings: false,
        timezone: "UTC",
      };
      const db = useDb({ salons: { data: config, error: null } });

      expect(await findAppointmentSalonConfig(SALON_ID)).toEqual(config);
      expect(operationsOn(db, "salons")[0]?.args[0]).toContain("min_booking_notice_minutes");

      useDb({ salons: { data: null, error: null } });
      expect(await findAppointmentSalonConfig(SALON_ID)).toBeNull();

      useDb({ salons: { data: null, error: { message: "caido" } } });
      await expect(findAppointmentSalonConfig(SALON_ID)).rejects.toEqual({ message: "caido" });
    });
  });

  describe("findBusinessHours", () => {
    it("lista el horario del salon ordenado por dia y devuelve lista vacia sin datos", async () => {
      const db = useDb({ salon_business_hours: { data: [{ day_of_week: 1, is_open: true, open_time: "09:00", close_time: "18:00" }], error: null } });

      expect(await findBusinessHours(SALON_ID)).toEqual([
        { day_of_week: 1, is_open: true, open_time: "09:00", close_time: "18:00" },
      ]);
      expect(operationsOn(db, "salon_business_hours")).toEqual([
        { target: "salon_business_hours", method: "select", args: ["day_of_week, is_open, open_time, close_time"] },
        { target: "salon_business_hours", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "salon_business_hours", method: "order", args: ["day_of_week", { ascending: true }] },
      ]);

      useDb({ salon_business_hours: { data: null, error: null } });
      expect(await findBusinessHours(SALON_ID)).toEqual([]);

      useDb({ salon_business_hours: { data: null, error: { message: "horario caido" } } });
      await expect(findBusinessHours(SALON_ID)).rejects.toEqual({ message: "horario caido" });
    });
  });

  describe("updates del salon", () => {
    it.each([
      ["nombre", () => updateSalonName(SALON_ID, "Nuevo"), { name: "Nuevo" }],
      ["tema", () => updateSalonTheme(SALON_ID, "dark"), { theme: "dark" }],
      ["fondo", () => updateSalonBackground(SALON_ID, "dots"), { bg_style: "dots" }],
      ["metodos de pago", () => updateSalonPaymentMethods(SALON_ID, ["cash", "card"]), { payment_methods: ["cash", "card"] }],
    ])("actualiza %s del salon indicado", async (_label, run, payload) => {
      const db = useDb({ salons: { data: null, error: null } });

      await run();

      expect(operationsOn(db, "salons")).toEqual([
        { target: "salons", method: "update", args: [payload] },
        { target: "salons", method: "eq", args: ["id", SALON_ID] },
      ]);
    });

    it("propaga el error de actualizacion", async () => {
      const dbError = { message: "fallo" };
      useDb({ salons: { data: null, error: dbError } });

      await expect(updateSalonName(SALON_ID, "Nuevo")).rejects.toBe(dbError);
    });
  });

  describe("upsertBusinessHours", () => {
    it("hace upsert de las filas de horario usando salon_id+day_of_week como conflicto", async () => {
      const db = useDb({ salon_business_hours: { data: null, error: null } });
      const rows = [
        { salon_id: SALON_ID, day_of_week: 0, is_open: false, open_time: null, close_time: null },
      ];

      await upsertBusinessHours(rows);

      expect(operationsOn(db, "salon_business_hours")).toEqual([
        { target: "salon_business_hours", method: "upsert", args: [rows, { onConflict: "salon_id,day_of_week" }] },
      ]);
    });

    it("propaga el error del upsert", async () => {
      const dbError = { message: "fallo" };
      useDb({ salon_business_hours: { data: null, error: dbError } });

      await expect(upsertBusinessHours([])).rejects.toBe(dbError);
    });
  });
});
