import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { getOccupiedSlotsForSalonDate } from "@/features/appointments/use-cases/appointment-availability";
import { cancelAppointment } from "@/features/appointments/use-cases/cancel-appointment";
import { completeAppointment } from "@/features/appointments/use-cases/complete-appointment";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { createAppointment } from "@/features/appointments/use-cases/create-appointment";
import { updateAppointmentSchedule } from "@/features/appointments/use-cases/update-appointment";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID, USER_ID } from "@/test/action-fixtures";
import {
  cancelAppointmentAction,
  completeAppointmentAction,
  confirmAppointmentAction,
  createAppointmentAction,
  getOccupiedSlotsForDate,
  getOccupiedSlotsForEditDate,
  updateAppointmentScheduleAction,
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
vi.mock("@/features/salon", () => ({ assertSalonPaymentMethodEnabled: vi.fn() }));
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
const SERVICE_ID = "00000000-0000-4000-8000-0000000000cc";
const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000dd";
const START = "2026-10-01T10:00:00.000Z";
const assignments = JSON.stringify([{ service_id: SERVICE_ID, employee_id: EMPLOYEE_ID }]);
const manager = buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] });
const LIMITED = err("Demasiados intentos.");

describe("appointments actions: rate limit por acción", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(LIMITED);
  });

  it("aplica el ámbito appointments con 120 peticiones por minuto", async () => {
    await cancelAppointmentAction(formDataOf({ appointment_id: RECORD_ID, idempotency_key: KEY }));

    expect(assertActionRateLimit).toHaveBeenCalledWith(USER_ID, "appointments", {
      max: 120,
      windowMs: 60_000,
    });
  });

  it("createAppointmentAction devuelve el rechazo sin consultar planes ni crear", async () => {
    const formData = formDataOf({
      customer_id: RECORD_ID,
      start_time: START,
      assignments,
      idempotency_key: KEY,
    });

    expect(await createAppointmentAction(null, formData)).toEqual(LIMITED);
    expect(createAppointment).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("updateAppointmentScheduleAction devuelve el rechazo sin reprogramar", async () => {
    const formData = formDataOf({
      appointment_id: RECORD_ID,
      start_time: START,
      assignments,
      idempotency_key: KEY,
    });

    expect(await updateAppointmentScheduleAction(null, formData)).toEqual(LIMITED);
    expect(updateAppointmentSchedule).not.toHaveBeenCalled();
  });

  it("cancelAppointmentAction y confirmAppointmentAction devuelven el rechazo sin tocar la cita", async () => {
    const formData = formDataOf({ appointment_id: RECORD_ID, idempotency_key: KEY });

    expect(await cancelAppointmentAction(formData)).toEqual(LIMITED);
    expect(await confirmAppointmentAction(formData)).toEqual(LIMITED);
    expect(cancelAppointment).not.toHaveBeenCalled();
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("completeAppointmentAction devuelve el rechazo sin completar la cita", async () => {
    const formData = formDataOf({
      appointment_id: RECORD_ID,
      payment_method: "cash",
      item_charges: JSON.stringify([{ id: SERVICE_ID, price: 150 }]),
      idempotency_key: KEY,
    });

    expect(await completeAppointmentAction(null, formData)).toEqual(LIMITED);
    expect(completeAppointment).not.toHaveBeenCalled();
  });

  it("las consultas de agenda devuelven vacío cuando el límite bloquea", async () => {
    expect(await getOccupiedSlotsForDate("2026-10-01")).toEqual({});
    expect(await getOccupiedSlotsForEditDate("2026-10-01", RECORD_ID)).toEqual({});
    expect(getOccupiedSlotsForSalonDate).not.toHaveBeenCalled();
  });

  it("la consulta de agenda devuelve el resultado del caso de uso cuando no hay límite", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(getOccupiedSlotsForSalonDate).mockResolvedValue({ [EMPLOYEE_ID]: [] });

    expect(await getOccupiedSlotsForDate("2026-10-01")).toEqual({ [EMPLOYEE_ID]: [] });
    expect(getOccupiedSlotsForSalonDate).toHaveBeenCalledWith(SALON_ID, "2026-10-01");
  });
});
