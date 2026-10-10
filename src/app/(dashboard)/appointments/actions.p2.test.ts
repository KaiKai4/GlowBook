import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { getOccupiedSlotsForSalonDate } from "@/features/appointments/use-cases/appointment-availability";
import { cancelAppointment } from "@/features/appointments/use-cases/cancel-appointment";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID } from "@/test/action-fixtures";
import {
  cancelAppointmentAction,
  confirmAppointmentAction,
  getOccupiedSlotsForEditDate,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", async () => {
  // requireActionContext deriva el contexto minimo del mismo mock de perfil que usa el test.
  const { contextFromProfile } = await import("@/test/action-fixtures");
  const requireActiveProfile = vi.fn();
  return {
    requireActiveProfile,
    requireActionContext: vi.fn(async () => contextFromProfile(await requireActiveProfile())),
  };
});
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
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

const KEY = "00000000-0000-4000-8000-0000000000c1";
const INVALID_ID = { ok: false, error: "ID de cita inválido" } as const;
const manager = buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] });

function lifecycleForm(appointmentId: string, idempotencyKey = KEY): FormData {
  return formDataOf({ appointment_id: appointmentId, idempotency_key: idempotencyKey });
}

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
    expect(await cancelAppointmentAction(lifecycleForm("cita-1"))).toEqual(INVALID_ID);
    expect(cancelAppointment).not.toHaveBeenCalled();
  });

  it("cancelAppointmentAction exige la clave de idempotencia sin cancelar", async () => {
    expect(await cancelAppointmentAction(lifecycleForm(RECORD_ID, "no-uuid"))).toEqual({
      ok: false,
      error: "La clave de idempotencia debe ser un uuid.",
    });
    expect(cancelAppointment).not.toHaveBeenCalled();
  });

  it("cancelAppointmentAction devuelve el error del caso de uso sin revalidar", async () => {
    vi.mocked(cancelAppointment).mockResolvedValue(err("La cita ya fue completada."));

    expect(await cancelAppointmentAction(lifecycleForm(RECORD_ID))).toEqual({
      ok: false,
      error: "La cita ya fue completada.",
    });
  });

  it("cancelAppointmentAction reenvía el id de la cita y la clave al caso de uso", async () => {
    vi.mocked(cancelAppointment).mockResolvedValue(ok(undefined));

    expect(await cancelAppointmentAction(lifecycleForm(RECORD_ID))).toEqual(ok(undefined));
    expect(cancelAppointment).toHaveBeenCalledWith({
      appointmentId: RECORD_ID,
      salonId: manager.salon_id,
      idempotencyKey: KEY,
      customerDisposition: "keep",
    });
  });

  it("confirmAppointmentAction rechaza un identificador inválido sin confirmar", async () => {
    expect(await confirmAppointmentAction(lifecycleForm("cita-1"))).toEqual(INVALID_ID);
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("confirmAppointmentAction confirma con el identificador del salón y la clave", async () => {
    vi.mocked(confirmAppointment).mockResolvedValue(ok(undefined));

    expect(await confirmAppointmentAction(lifecycleForm(RECORD_ID))).toEqual(ok(undefined));
    expect(confirmAppointment).toHaveBeenCalledWith(RECORD_ID, manager.salon_id, KEY);
  });
});
