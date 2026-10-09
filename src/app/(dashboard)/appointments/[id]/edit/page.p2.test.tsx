// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";
import { getAppointmentDetail, type AppointmentDetailViewModel } from "@/features/appointments/use-cases/get-appointment-detail";
import { getAppointmentWizardData } from "@/features/appointments/use-cases/get-appointment-wizard-data";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { buildProfile, SALON_ID } from "@/test/action-fixtures";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import EditAppointmentPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/auth/session", () => ({ requireProfile: vi.fn() }));
vi.mock("@/features/appointments/use-cases/get-appointment-detail", () => ({
  getAppointmentDetail: vi.fn(),
}));
vi.mock("@/features/appointments/use-cases/get-appointment-wizard-data", () => ({
  getAppointmentWizardData: vi.fn(),
}));
vi.mock("./appointment-edit-form", () => ({
  AppointmentEditForm: (props: { appointment: { customerName: string }; services: unknown[] }) => (
    <section>
      Formulario de {props.appointment.customerName} con {props.services.length} servicios
    </section>
  ),
}));

const APPOINTMENT_ID = "00000000-0000-4000-8000-0000000000a1";
const NOT_UUID = "cita-1";

function appointment(status: string): AppointmentDetailViewModel {
  return { id: APPOINTMENT_ID, customerName: "Laura Gómez", status } as unknown as AppointmentDetailViewModel;
}

const WIZARD_DATA = {
  categories: [],
  services: [{ id: "srv-1" }, { id: "srv-2" }],
  employees: [],
  salonConfig: {},
  businessHours: [],
};

describe("EditAppointmentPage", () => {
  let mounted: MountedComponent | null = null;
  const manager = buildProfile({ permissions: [PERMISSIONS.APPOINTMENTS_MANAGE] });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProfile).mockResolvedValue(manager);
    vi.mocked(getAppointmentDetail).mockResolvedValue(appointment("scheduled"));
    vi.mocked(getAppointmentWizardData).mockResolvedValue(WIZARD_DATA as never);
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("responde notFound sin consultar la cita cuando el identificador no es UUID", async () => {
    await expect(EditAppointmentPage({ params: Promise.resolve({ id: NOT_UUID }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(notFound).toHaveBeenCalled();
    expect(getAppointmentDetail).not.toHaveBeenCalled();
    expect(getAppointmentWizardData).not.toHaveBeenCalled();
  });

  it("niega la edición sin consultar datos cuando falta el permiso de citas", async () => {
    vi.mocked(requireProfile).mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.SALON_MANAGE] }));

    mounted = mountComponent(await EditAppointmentPage({ params: Promise.resolve({ id: APPOINTMENT_ID }) }));

    expect(mounted.container.textContent).toContain("No tienes permiso para editar citas.");
    expect(getAppointmentDetail).not.toHaveBeenCalled();
  });

  it("responde notFound cuando la cita no pertenece al salón", async () => {
    vi.mocked(getAppointmentDetail).mockResolvedValue(null);

    await expect(EditAppointmentPage({ params: Promise.resolve({ id: APPOINTMENT_ID }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(getAppointmentDetail).toHaveBeenCalledWith({ appointmentId: APPOINTMENT_ID, salonId: SALON_ID });
  });

  it("muestra el formulario de edición con los datos del asistente para una cita abierta", async () => {
    mounted = mountComponent(await EditAppointmentPage({ params: Promise.resolve({ id: APPOINTMENT_ID }) }));

    const text = mounted.container.textContent ?? "";
    expect(mounted.container.querySelector("h1")?.textContent).toBe("Editar cita");
    expect(text).toContain("Laura Gómez");
    expect(text).toContain("Formulario de Laura Gómez con 2 servicios");
    expect(text).not.toContain("ya está cerrada");
    expect(getAppointmentWizardData).toHaveBeenCalledWith(SALON_ID);
  });

  it.each(["completed", "cancelled", "no_show"])(
    "bloquea la edición de una cita con estado %s",
    async (status) => {
      vi.mocked(getAppointmentDetail).mockResolvedValue(appointment(status));

      mounted = mountComponent(await EditAppointmentPage({ params: Promise.resolve({ id: APPOINTMENT_ID }) }));

      const text = mounted.container.textContent ?? "";
      expect(text).toContain("Esta cita ya está cerrada y no se puede editar.");
      expect(text).not.toContain("Formulario de");
    }
  );
});
