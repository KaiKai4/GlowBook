import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  findAppointmentSalonConfig,
  findDashboardShellSalon,
  findSalonIdentity,
  findSalonSettings,
  updateSalonName,
  updateSalonPaymentMethods,
} from "./salon-settings.repo";

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

describe("salon-settings.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("findSalonSettings", () => {
    it("devuelve los ajustes del salón filtrando por id", async () => {
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

    it("devuelve null si el salón no existe en la consulta de fallback", async () => {
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
    it("devuelve nombre, zona horaria y métodos de pago", async () => {
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
    it("devuelve el salón para el shell del dashboard o null si no hay fila", async () => {
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

    it("devuelve la configuración de agenda del salón o null", async () => {
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

  describe("updates de nombre y métodos de pago", () => {
    it.each([
      ["nombre", () => updateSalonName(SALON_ID, "Nuevo"), { name: "Nuevo" }],
      ["métodos de pago", () => updateSalonPaymentMethods(SALON_ID, ["cash", "card"]), { payment_methods: ["cash", "card"] }],
    ])("actualiza %s del salón indicado", async (_label, run, payload) => {
      const db = useDb({ salons: { data: null, error: null } });

      await run();

      expect(operationsOn(db, "salons")).toEqual([
        { target: "salons", method: "update", args: [payload] },
        { target: "salons", method: "eq", args: ["id", SALON_ID] },
      ]);
    });

    it("propaga el error de actualización", async () => {
      const dbError = { message: "fallo" };
      useDb({ salons: { data: null, error: dbError } });

      await expect(updateSalonName(SALON_ID, "Nuevo")).rejects.toBe(dbError);
    });
  });
});
