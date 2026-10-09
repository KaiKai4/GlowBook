import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { updateBusinessHours } from "@/features/salon/use-cases/update-business-hours";
import { updateSalonBackground } from "@/features/salon/use-cases/update-salon-background";
import { updateSalonInfo } from "@/features/salon/use-cases/update-salon-info";
import { updateSalonPaymentMethods } from "@/features/salon/use-cases/update-salon-payment-methods";
import { updateSalonTheme } from "@/features/salon/use-cases/update-salon-theme";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, SALON_ID } from "@/test/action-fixtures";
import {
  updateBusinessHoursAction,
  updateSalonBgAction,
  updateSalonInfoAction,
  updateSalonPaymentMethodsAction,
  updateSalonThemeAction,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/salon/use-cases/update-business-hours", () => ({ updateBusinessHours: vi.fn() }));
vi.mock("@/features/salon/use-cases/update-salon-background", () => ({ updateSalonBackground: vi.fn() }));
vi.mock("@/features/salon/use-cases/update-salon-info", () => ({ updateSalonInfo: vi.fn() }));
vi.mock("@/features/salon/use-cases/update-salon-payment-methods", () => ({
  updateSalonPaymentMethods: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/update-salon-theme", () => ({ updateSalonTheme: vi.fn() }));

const salonAdmin = buildProfile({ permissions: [PERMISSIONS.SALON_MANAGE] });
const permissionError = "No tienes permiso para editar el salon.";

type DayHours = {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
};

/** Horario semanal de 7 días cerrados (0 = lunes ... 6 = domingo). */
function closedWeek(): DayHours[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day_of_week: day,
    is_open: false,
    open_time: null,
    close_time: null,
  }));
}

describe("salon actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(salonAdmin);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
  });

  it("todas las acciones rechazan sin permiso de salón y propagan el rate limit", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());
    expect(await updateSalonThemeAction("dark")).toEqual({ ok: false, error: permissionError });
    expect(await updateSalonBgAction("dots")).toEqual({ ok: false, error: permissionError });
    expect(updateSalonTheme).not.toHaveBeenCalled();
    expect(updateSalonBackground).not.toHaveBeenCalled();

    vi.mocked(requireActiveProfile).mockResolvedValue(salonAdmin);
    vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));
    expect(await updateSalonInfoAction(null, formDataOf({ name: "Salón" }))).toEqual({
      ok: false,
      error: "Demasiados intentos.",
    });
    expect(updateSalonInfo).not.toHaveBeenCalled();
  });

  describe("información, tema y fondo", () => {
    it("rechaza un nombre vacío con el mensaje de Zod", async () => {
      expect(await updateSalonInfoAction(null, formDataOf({ name: "" }))).toEqual({
        ok: false,
        error: "El nombre del salón es obligatorio",
      });
      expect(updateSalonInfo).not.toHaveBeenCalled();
    });

    it("actualiza el nombre y revalida el layout completo", async () => {
      vi.mocked(updateSalonInfo).mockResolvedValue(ok(undefined));

      expect(await updateSalonInfoAction(null, formDataOf({ name: "Salón Luna" }))).toEqual({
        ok: true,
        value: undefined,
      });
      expect(updateSalonInfo).toHaveBeenCalledWith(SALON_ID, { name: "Salón Luna" });
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("cambia el tema y el fondo, revalidando solo cuando el caso de uso tiene éxito", async () => {
      vi.mocked(updateSalonTheme).mockResolvedValue(ok(undefined));
      vi.mocked(updateSalonBackground).mockResolvedValue(err("Fondo no disponible."));

      expect(await updateSalonThemeAction("dark")).toEqual({ ok: true, value: undefined });
      expect(updateSalonTheme).toHaveBeenCalledWith(SALON_ID, "dark");
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");

      vi.mocked(revalidatePath).mockClear();
      expect(await updateSalonBgAction("dots")).toEqual({ ok: false, error: "Fondo no disponible." });
      expect(updateSalonBackground).toHaveBeenCalledWith(SALON_ID, "dots");
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("horario de atención", () => {
    it("rechaza un horario que no es JSON válido", async () => {
      expect(await updateBusinessHoursAction("{no-json")).toEqual({
        ok: false,
        error: "Datos de horario invalidos.",
      });
      expect(updateBusinessHours).not.toHaveBeenCalled();
    });

    it("rechaza un día donde la hora de cierre es anterior a la de apertura", async () => {
      const week = closedWeek();
      week[0] = { day_of_week: 0, is_open: true, open_time: "18:00", close_time: "09:00" };

      expect(await updateBusinessHoursAction(JSON.stringify(week))).toEqual({
        ok: false,
        error: "La hora de cierre debe ser mayor que la de apertura.",
      });
      expect(updateBusinessHours).not.toHaveBeenCalled();
    });

    it("rechaza un horario que no tiene los 7 días", async () => {
      const result = await updateBusinessHoursAction(JSON.stringify(closedWeek().slice(0, 6)));

      expect(result.ok).toBe(false);
      expect(updateBusinessHours).not.toHaveBeenCalled();
    });

    it("guarda el horario válido y revalida salón y citas", async () => {
      vi.mocked(updateBusinessHours).mockResolvedValue(ok(undefined));
      const week = closedWeek();
      week[1] = { day_of_week: 1, is_open: true, open_time: "09:00", close_time: "18:00" };

      expect(await updateBusinessHoursAction(JSON.stringify(week))).toEqual({ ok: true, value: undefined });
      expect(updateBusinessHours).toHaveBeenCalledWith(SALON_ID, expect.arrayContaining([
        expect.objectContaining({ day_of_week: 1, open_time: "09:00", close_time: "18:00" }),
      ]));
      for (const path of ["/salon", "/appointments", "/appointments/new"]) {
        expect(revalidatePath).toHaveBeenCalledWith(path);
      }
    });
  });

  describe("métodos de pago", () => {
    it("rechaza un método de pago vacío", async () => {
      expect(await updateSalonPaymentMethodsAction(["cash", "   "])).toEqual({
        ok: false,
        error: "El metodo de pago es obligatorio.",
      });
      expect(updateSalonPaymentMethods).not.toHaveBeenCalled();
    });

    it("normaliza los métodos antes de guardarlos y revalida salón, citas y vitrina", async () => {
      vi.mocked(updateSalonPaymentMethods).mockResolvedValue(ok(undefined));

      expect(await updateSalonPaymentMethodsAction(["  Tarjeta  de   crédito ", "cash"])).toEqual({
        ok: true,
        value: undefined,
      });
      expect(updateSalonPaymentMethods).toHaveBeenCalledWith(SALON_ID, ["Tarjeta de crédito", "cash"]);
      for (const path of ["/salon", "/appointments", "/retail"]) {
        expect(revalidatePath).toHaveBeenCalledWith(path);
      }
    });
  });
});
