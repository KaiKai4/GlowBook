import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import type { CreateAppointmentInput } from "@/features/appointments/schemas";
import { err, ok } from "@/infra/result";
import { createAppointment } from "./create-appointment";
import { createAppointmentWithPlanChecks } from "./create-appointment-checks";

vi.mock("@/features/billing", () => ({
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));
vi.mock("./create-appointment", () => ({ createAppointment: vi.fn() }));

const SALON_ID = "00000000-0000-4000-8000-0000000000a1";
const USER_ID = "00000000-0000-4000-8000-0000000000b2";
const KEY = "00000000-0000-4000-8000-0000000000c3";
const NEW_CUSTOMER = { first_name: "Luis", last_name: "Soto", phone: "+50761112233" };
const input = { idempotency_key: KEY, new_customer: NEW_CUSTOMER } as CreateAppointmentInput;
const context = { salonId: SALON_ID, userId: USER_ID };

describe("createAppointmentWithPlanChecks con cliente nuevo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(createAppointment).mockResolvedValue(ok("appointment-id"));
  });

  it("no comprueba el cupo de clientes activos: el cliente temporal no lo consume", async () => {
    await createAppointmentWithPlanChecks(input, context);

    expect(checkPlanModuleAccess).not.toHaveBeenCalledWith({ salonId: SALON_ID, moduleKey: "customers" });
    expect(checkPlanLimit).not.toHaveBeenCalledWith({ salonId: SALON_ID, metricKey: "customers.active" });
  });

  it("un salón en el límite de clientes activos puede crear la cita con cliente nuevo", async () => {
    vi.mocked(checkPlanLimit).mockImplementation(async ({ metricKey }) =>
      metricKey === "customers.active" ? err("Límite de clientes alcanzado.") : ok(undefined)
    );

    expect(await createAppointmentWithPlanChecks(input, context)).toEqual(ok("appointment-id"));
    expect(createAppointment).toHaveBeenCalledTimes(1);
  });

  it("hace una sola llamada al caso de uso de cita con el cliente nuevo", async () => {
    const result = await createAppointmentWithPlanChecks(input, context);

    expect(createAppointment).toHaveBeenCalledTimes(1);
    expect(createAppointment).toHaveBeenCalledWith(input, { salonId: SALON_ID, userId: USER_ID, idempotencyKey: KEY });
    expect(result).toEqual(ok("appointment-id"));
  });
});
