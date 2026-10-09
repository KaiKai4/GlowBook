import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import { getOccupiedSlotsForSalonDate } from "@/features/appointments/use-cases/appointment-availability";
import { cancelAppointment } from "@/features/appointments/use-cases/cancel-appointment";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { err, ok } from "@/lib/result";
import { buildProfile, RECORD_ID } from "@/test/action-fixtures";
import {
  cancelAppointmentAction,
  confirmAppointmentAction,
  getOccupiedSlotsForEditDate,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/salon-payment-methods", () => ({
  assertSalonPaymentMethodEnabled: vi.fn(),
}));
vi.mock("@/features/appointments/use-cases/appointment-availability", () => ({
  getOccupiedSlotsForSalonDate: vi.fn(),
}));
vi.mock("@/features/appointments/use-cases/cancel-appointment", () => ({ cancelAppointment: vi.fn() }));
vi.mock("@/features/appointments/use-cases/complete-appointment", () => ({ completeAppointment: vi.fn() }));
vi.mock("@/features/appointments/use-cases/confirm-appointment", () => ({ confirmAppointment: vi.fn() }));
vi.mock("@/features/appointments/use-cases/create-appointment", () => ({ createAppointment: vi.fn() }));
vi.mock("@/features/appointments/use-cases/update-appointment", () => ({
  updateAppointmentSchedule: vi.fn(),
}));

const INVALID = { ok: false, error: "Identificador inválido." } as const;
const manager = buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] });

describe("appointments actions: identificadores inválidos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
  });

  it("getOccupiedSlotsForEditDate devuelve vacío sin consultar la agenda si la cita no es UUID", async () => {
    expect(await getOccupiedSlotsForEditDate("2026-10-01", "cita-1")).toEqual({});
    expect(getOccupiedSlotsForSalonDate).not.toHaveBeenCalled();
  });

  it("cancelAppointmentAction rechaza un identificador inválido sin cancelar", async () => {
    expect(await cancelAppointmentAction("cita-1")).toEqual(INVALID);
    expect(cancelAppointment).not.toHaveBeenCalled();
  });

  it("cancelAppointmentAction devuelve el error del caso de uso sin revalidar", async () => {
    vi.mocked(cancelAppointment).mockResolvedValue(err("La cita ya fue completada."));

    expect(await cancelAppointmentAction(RECORD_ID)).toEqual({ ok: false, error: "La cita ya fue completada." });
  });

  it("confirmAppointmentAction rechaza un identificador inválido sin confirmar", async () => {
    expect(await confirmAppointmentAction("cita-1")).toEqual(INVALID);
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("confirmAppointmentAction confirma con el identificador del salón", async () => {
    vi.mocked(confirmAppointment).mockResolvedValue(ok(undefined));

    expect(await confirmAppointmentAction(RECORD_ID)).toEqual(ok(undefined));
    expect(confirmAppointment).toHaveBeenCalledWith(RECORD_ID, manager.salon_id);
  });
});
