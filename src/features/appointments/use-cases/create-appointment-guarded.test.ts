import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import type { CreateAppointmentInput } from "@/features/appointments/schemas";
import { err, ok } from "@/infra/result";
import { createAppointment } from "./create-appointment";
import { createAppointmentGuarded } from "./create-appointment-guarded";

vi.mock("@/features/billing", () => ({
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));
vi.mock("./create-appointment", () => ({ createAppointment: vi.fn() }));

const SALON_ID = "00000000-0000-4000-8000-0000000000a1";
const USER_ID = "00000000-0000-4000-8000-0000000000b2";
const KEY = "00000000-0000-4000-8000-0000000000c3";
const input = { idempotency_key: KEY } as CreateAppointmentInput;
const context = { salonId: SALON_ID, userId: USER_ID };

describe("createAppointmentGuarded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(createAppointment).mockResolvedValue(ok("appointment-id"));
  });

  it("consulta el módulo de citas y el cupo de citas del salón antes de crear", async () => {
    await createAppointmentGuarded(input, context);

    expect(checkPlanModuleAccess).toHaveBeenCalledWith({ salonId: SALON_ID, moduleKey: "appointments" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON_ID, metricKey: "appointments.total" });
  });

  it("crea la cita con el salón, el usuario y la clave de idempotencia", async () => {
    const result = await createAppointmentGuarded(input, context);

    expect(createAppointment).toHaveBeenCalledWith(input, {
      salonId: SALON_ID,
      userId: USER_ID,
      idempotencyKey: KEY,
    });
    expect(result).toEqual(ok("appointment-id"));
  });

  it("si el módulo no está en el plan devuelve su error sin crear", async () => {
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));

    expect(await createAppointmentGuarded(input, context)).toEqual(err("Módulo no incluido en tu plan."));
    expect(checkPlanLimit).not.toHaveBeenCalled();
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it("si no queda cupo de citas devuelve el error del plan sin crear", async () => {
    vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de citas alcanzado."));

    expect(await createAppointmentGuarded(input, context)).toEqual(err("Límite de citas alcanzado."));
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it("propaga el error del caso de uso de creación", async () => {
    vi.mocked(createAppointment).mockResolvedValue(err("Conflicto de horario."));

    expect(await createAppointmentGuarded(input, context)).toEqual(err("Conflicto de horario."));
  });
});
