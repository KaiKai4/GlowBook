import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { getOccupiedSlotsForSalonDate } from "@/features/appointments/use-cases/appointment-availability";
import { cancelAppointment } from "@/features/appointments/use-cases/cancel-appointment";
import { completeAppointment } from "@/features/appointments/use-cases/complete-appointment";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { createAppointment } from "@/features/appointments/use-cases/create-appointment";
import { updateAppointmentSchedule } from "@/features/appointments/use-cases/update-appointment";
import { assertSalonPaymentMethodEnabled } from "@/features/salon/use-cases/salon-payment-methods";
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
vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanModuleAccess: vi.fn(),
  checkPlanLimit: vi.fn(),
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

const SERVICE_ID = "00000000-0000-4000-8000-0000000000cc";
const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000dd";
const START = "2026-10-01T10:00:00.000Z";
const assignments = JSON.stringify([{ service_id: SERVICE_ID, employee_id: EMPLOYEE_ID }]);
const manager = buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] });

const KEY = "00000000-0000-4000-8000-0000000000c1";
const validCreate = { customer_id: RECORD_ID, start_time: START, assignments, idempotency_key: KEY };
const validUpdate = { appointment_id: RECORD_ID, start_time: START, assignments, idempotency_key: KEY };
const validComplete = {
  appointment_id: RECORD_ID,
  payment_method: "cash",
  item_charges: JSON.stringify([{ id: SERVICE_ID, price: 150 }]),
  idempotency_key: KEY,
};
const completedResult = {
  appointment_id: RECORD_ID,
  status: "completed" as const,
  subtotal: 150,
  discount_amount: 0,
  total_price: 150,
};
const lifecycleForm = () => formDataOf({ appointment_id: RECORD_ID, idempotency_key: KEY });

describe("appointments actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(assertSalonPaymentMethodEnabled).mockResolvedValue(true);
  });

  describe("disponibilidad", () => {
    it("devuelve vacío sin consultar cuando el perfil no puede gestionar citas", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect(await getOccupiedSlotsForDate("2026-10-01")).toEqual({});
      expect(await getOccupiedSlotsForEditDate("2026-10-01", RECORD_ID)).toEqual({});
      expect(getOccupiedSlotsForSalonDate).not.toHaveBeenCalled();
    });

    it("consulta la agenda del salón para la fecha y excluye la cita en edición", async () => {
      const occupied = {
        [EMPLOYEE_ID]: [{ start_time: START, end_time: "2026-10-01T11:00:00.000Z" }],
      };
      vi.mocked(getOccupiedSlotsForSalonDate).mockResolvedValue(occupied);

      expect(await getOccupiedSlotsForDate("2026-10-01")).toEqual(occupied);
      expect(getOccupiedSlotsForSalonDate).toHaveBeenLastCalledWith(SALON_ID, "2026-10-01");

      await getOccupiedSlotsForEditDate("2026-10-02", RECORD_ID);
      expect(getOccupiedSlotsForSalonDate).toHaveBeenLastCalledWith(SALON_ID, "2026-10-02", RECORD_ID);
    });
  });

  describe("createAppointmentAction", () => {
    it("rechaza sin permiso de citas", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect(await createAppointmentAction(null, formDataOf(validCreate))).toEqual({
        ok: false,
        error: "No tienes permiso para crear citas.",
      });
      expect(createAppointment).not.toHaveBeenCalled();
    });

    it("propaga el límite de peticiones, el módulo y el límite del plan", async () => {
      // El rechazo por rate limit llega tal cual, sin sustituirlo por el mensaje de permiso.
      vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));
      expect(await createAppointmentAction(null, formDataOf(validCreate))).toEqual({
        ok: false,
        error: "Demasiados intentos.",
      });
      expect(createAppointment).not.toHaveBeenCalled();

      vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
      vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));
      expect(await createAppointmentAction(null, formDataOf(validCreate))).toEqual({
        ok: false,
        error: "Módulo no incluido en tu plan.",
      });

      vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
      vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de citas alcanzado."));
      expect(await createAppointmentAction(null, formDataOf(validCreate))).toEqual({
        ok: false,
        error: "Límite de citas alcanzado.",
      });
      expect(createAppointment).not.toHaveBeenCalled();
    });

    it("rechaza servicios que no son JSON válido", async () => {
      expect(
        await createAppointmentAction(null, formDataOf({ ...validCreate, assignments: "{no-json" }))
      ).toEqual({ ok: false, error: "Datos de servicios invalidos." });
      expect(createAppointment).not.toHaveBeenCalled();
    });

    it("devuelve el primer issue de Zod para fecha inválida y para lista de servicios vacía", async () => {
      expect(
        await createAppointmentAction(null, formDataOf({ ...validCreate, start_time: "mañana" }))
      ).toEqual({ ok: false, error: "Fecha/hora inválida" });

      expect(
        await createAppointmentAction(null, formDataOf({ ...validCreate, assignments: "[]" }))
      ).toEqual({ ok: false, error: "Selecciona al menos un servicio" });
      expect(createAppointment).not.toHaveBeenCalled();
    });

    it("crea la cita con el salón y el usuario del perfil y revalida /appointments", async () => {
      vi.mocked(createAppointment).mockResolvedValue(ok("appt-1"));

      const result = await createAppointmentAction(null, formDataOf(validCreate));

      expect(result).toEqual({ ok: true, value: "appt-1" });
      expect(createAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: RECORD_ID,
          assignments: [{ service_id: SERVICE_ID, employee_id: EMPLOYEE_ID }],
        }),
        { salonId: SALON_ID, userId: USER_ID, idempotencyKey: KEY }
      );
      expect(revalidatePath).toHaveBeenCalledWith("/appointments");
    });

    it("no revalida cuando la creación falla", async () => {
      vi.mocked(createAppointment).mockResolvedValue(err("Horario ocupado."));

      expect(await createAppointmentAction(null, formDataOf(validCreate))).toEqual({
        ok: false,
        error: "Horario ocupado.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("updateAppointmentScheduleAction", () => {
    it("rechaza sin permiso de citas con su mensaje propio", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect(await updateAppointmentScheduleAction(null, formDataOf(validUpdate))).toEqual({
        ok: false,
        error: "No tienes permiso para editar citas.",
      });
      expect(updateAppointmentSchedule).not.toHaveBeenCalled();
    });

    it("rechaza servicios que no son JSON válido", async () => {
      expect(
        await updateAppointmentScheduleAction(null, formDataOf({ ...validUpdate, assignments: "[" }))
      ).toEqual({ ok: false, error: "Datos de servicios invalidos." });
    });

    it("devuelve el primer issue de Zod cuando no hay servicios", async () => {
      const result = await updateAppointmentScheduleAction(
        null,
        formDataOf({ ...validUpdate, assignments: "[]" })
      );

      expect(result).toEqual({ ok: false, error: "Selecciona al menos un servicio" });
      expect(updateAppointmentSchedule).not.toHaveBeenCalled();
    });

    it("reprograma la cita y revalida solo si tiene éxito", async () => {
      vi.mocked(updateAppointmentSchedule).mockResolvedValue(ok(undefined));

      expect(await updateAppointmentScheduleAction(null, formDataOf(validUpdate))).toEqual({
        ok: true,
        value: undefined,
      });
      expect(updateAppointmentSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ appointment_id: RECORD_ID }),
        { salonId: SALON_ID, idempotencyKey: KEY }
      );
      expect(revalidatePath).toHaveBeenCalledWith("/appointments");

      vi.clearAllMocks();
      vi.mocked(requireActiveProfile).mockResolvedValue(manager);
      vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
      vi.mocked(updateAppointmentSchedule).mockResolvedValue(err("Solape de horario."));
      expect(await updateAppointmentScheduleAction(null, formDataOf(validUpdate))).toEqual({
        ok: false,
        error: "Solape de horario.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("cancelar y confirmar", () => {
    it("cancelAppointmentAction rechaza sin permiso, y cancela y revalida con permiso", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());
      expect(await cancelAppointmentAction(lifecycleForm())).toEqual({
        ok: false,
        error: "No tienes permiso para cancelar citas.",
      });
      expect(cancelAppointment).not.toHaveBeenCalled();

      vi.mocked(requireActiveProfile).mockResolvedValue(manager);
      vi.mocked(cancelAppointment).mockResolvedValue(ok(undefined));
      expect(await cancelAppointmentAction(lifecycleForm())).toEqual({ ok: true, value: undefined });
      expect(cancelAppointment).toHaveBeenCalledWith({
        appointmentId: RECORD_ID,
        salonId: SALON_ID,
        idempotencyKey: KEY,
        customerDisposition: "keep",
      });
      expect(revalidatePath).toHaveBeenCalledWith("/appointments");
    });

    it("cancelAppointmentAction pasa la decisión sobre el cliente temporal y acepta solo valores válidos", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(manager);
      vi.mocked(cancelAppointment).mockResolvedValue(ok(undefined));

      await cancelAppointmentAction(formDataOf({ appointment_id: RECORD_ID, idempotency_key: KEY, customer_disposition: "promote" }));
      expect(cancelAppointment).toHaveBeenLastCalledWith(expect.objectContaining({ customerDisposition: "promote" }));

      const invalid = await cancelAppointmentAction(
        formDataOf({ appointment_id: RECORD_ID, idempotency_key: KEY, customer_disposition: "borrar" })
      );
      expect(invalid.ok).toBe(false);
      expect(cancelAppointment).toHaveBeenCalledTimes(1);
    });

    it("cancelAppointmentAction devuelve los avisos del caso de uso sin fallar", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(manager);
      vi.mocked(cancelAppointment).mockResolvedValue({ ok: true, value: undefined, warnings: ["Aviso de cliente."] });

      expect(await cancelAppointmentAction(lifecycleForm())).toEqual({
        ok: true,
        value: undefined,
        warnings: ["Aviso de cliente."],
      });
    });

    it("confirmAppointmentAction rechaza sin permiso, y confirma y revalida con permiso", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());
      expect(await confirmAppointmentAction(lifecycleForm())).toEqual({
        ok: false,
        error: "No tienes permiso para confirmar citas.",
      });
      expect(confirmAppointment).not.toHaveBeenCalled();

      vi.mocked(requireActiveProfile).mockResolvedValue(manager);
      vi.mocked(confirmAppointment).mockResolvedValue(err("La cita ya está cancelada."));
      expect(await confirmAppointmentAction(lifecycleForm())).toEqual({
        ok: false,
        error: "La cita ya está cancelada.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("completeAppointmentAction", () => {
    it("rechaza sin permiso de citas", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect(await completeAppointmentAction(null, formDataOf(validComplete))).toEqual({
        ok: false,
        error: "No tienes permiso para completar citas.",
      });
      expect(completeAppointment).not.toHaveBeenCalled();
    });

    it("rechaza los cobros que no son JSON válido", async () => {
      expect(
        await completeAppointmentAction(null, formDataOf({ ...validComplete, item_charges: "[" }))
      ).toEqual({ ok: false, error: "Cobros de servicios invalidos." });
    });

    it("devuelve el primer issue de Zod cuando la cita no tiene cobros", async () => {
      const result = await completeAppointmentAction(
        null,
        formDataOf({ ...validComplete, item_charges: "[]" })
      );

      expect(result).toEqual({ ok: false, error: "La cita debe tener al menos un servicio" });
      expect(completeAppointment).not.toHaveBeenCalled();
    });

    it("completa la cita con los cobros parseados y revalida citas y clientes", async () => {
      vi.mocked(completeAppointment).mockResolvedValue(ok(completedResult));

      const result = await completeAppointmentAction(null, formDataOf(validComplete));

      expect(result).toEqual({ ok: true, value: completedResult });
      expect(completeAppointment).toHaveBeenCalledWith({
        appointmentId: RECORD_ID,
        salonId: SALON_ID,
        paymentMethod: "cash",
        itemCharges: [{ id: SERVICE_ID, price: 150, discountPercentage: 0 }],
        completionPriceNote: "",
        idempotencyKey: KEY,
      });
      expect(revalidatePath).toHaveBeenCalledWith("/appointments");
      expect(revalidatePath).toHaveBeenCalledWith("/customers");
    });

    it("no revalida cuando completar la cita falla", async () => {
      vi.mocked(completeAppointment).mockResolvedValue(err("La cita ya fue completada."));

      expect(await completeAppointmentAction(null, formDataOf(validComplete))).toEqual({
        ok: false,
        error: "La cita ya fue completada.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
