import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSalonSchedulingConfig } from "@/features/salon";
import { err, ok } from "@/infra/result";
import { addEmployeeScheduleException } from "./employee-exceptions";
import { reactivateEmployee } from "./employee-lifecycle";
import { addScheduleExceptionFlow, reactivateEmployeeFlow } from "./employee-lifecycle-commands";

vi.mock("./employee-lifecycle", () => ({ reactivateEmployee: vi.fn() }));
vi.mock("./employee-exceptions", () => ({ addEmployeeScheduleException: vi.fn() }));
vi.mock("@/features/salon", () => ({ getSalonSchedulingConfig: vi.fn() }));

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "emp-1";

function schedulingConfig(timezone: string) {
  return {
    salonConfig: {
      min_booking_notice_minutes: 0,
      min_appointment_duration_minutes: 30,
      allow_off_hours_bookings: false,
      timezone,
    },
    businessHours: [],
  };
}

describe("reactivateEmployeeFlow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("corta con el error del cupo de activos sin reactivar", async () => {
    const checkActiveLimit = vi.fn(async () => err("Límite de colaboradores alcanzado."));

    expect(await reactivateEmployeeFlow({ salonId: SALON_ID, checkActiveLimit }, EMPLOYEE_ID)).toEqual(
      err("Límite de colaboradores alcanzado.")
    );
    expect(reactivateEmployee).not.toHaveBeenCalled();
  });

  it("reactiva tras el cupo con el salon de la sesion", async () => {
    const checkActiveLimit = vi.fn(async () => ok(undefined));
    vi.mocked(reactivateEmployee).mockResolvedValue(ok(undefined));

    expect(await reactivateEmployeeFlow({ salonId: SALON_ID, checkActiveLimit }, EMPLOYEE_ID)).toEqual(ok(undefined));
    expect(reactivateEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
  });
});

describe("addScheduleExceptionFlow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("usa la zona horaria del salon al registrar la excepcion", async () => {
    vi.mocked(getSalonSchedulingConfig).mockResolvedValue(schedulingConfig("America/Panama"));
    vi.mocked(addEmployeeScheduleException).mockResolvedValue(ok(undefined));

    const result = await addScheduleExceptionFlow(
      { salonId: SALON_ID },
      { employeeId: EMPLOYEE_ID, exceptionDate: "2026-10-12", reason: "Vacaciones" }
    );

    expect(result).toEqual(ok(undefined));
    expect(getSalonSchedulingConfig).toHaveBeenCalledWith(SALON_ID);
    expect(addEmployeeScheduleException).toHaveBeenCalledWith({
      salonId: SALON_ID,
      employeeId: EMPLOYEE_ID,
      exceptionDate: "2026-10-12",
      reason: "Vacaciones",
      timezone: "America/Panama",
    });
  });

  it("devuelve el error del caso de uso de excepciones", async () => {
    vi.mocked(getSalonSchedulingConfig).mockResolvedValue(schedulingConfig("UTC"));
    vi.mocked(addEmployeeScheduleException).mockResolvedValue(err("Selecciona una fecha válida."));

    expect(
      await addScheduleExceptionFlow({ salonId: SALON_ID }, { employeeId: EMPLOYEE_ID, exceptionDate: "x", reason: "" })
    ).toEqual(err("Selecciona una fecha válida."));
  });
});
