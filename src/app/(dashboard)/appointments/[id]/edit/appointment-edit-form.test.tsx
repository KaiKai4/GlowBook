// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import {
  getOccupiedSlotsForEditDate,
  updateAppointmentScheduleAction,
} from "@/app/(dashboard)/appointments/actions";
import type { AppointmentDetailViewModel } from "@/features/appointments/use-cases/get-appointment-detail";
import { formatCurrency } from "@/infra/format/dates";
import { ToastProvider } from "@/components/ui/toast";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  buildWizardProps,
  SALON_TZ,
  TEST_DATE,
  WIZARD_SERVICES,
} from "@/test/ui-appointments-fixtures";
import {
  buttonWithText,
  byAriaLabel,
  chooseOption,
  click,
  clickAndSettle,
  nativeOptionTexts,
  selectedLabelOf,
  setFieldValue,
  setFieldValueAndSettle,
} from "@/test/ui-appointments-dom";
import { AppointmentEditForm } from "./appointment-edit-form";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/ui/date-picker", () => import("@/test/ui-appointments-pickers"));
vi.mock("@/components/ui/time-picker", () => import("@/test/ui-appointments-pickers"));
vi.mock("@/app/(dashboard)/appointments/actions", () => ({
  getOccupiedSlotsForEditDate: vi.fn(),
  updateAppointmentScheduleAction: vi.fn(),
}));

/** Cita existente: corte de 14:00 a 15:00 (hora de Panamá) con Lucía Gómez. */
function buildAppointment(overrides: Partial<AppointmentDetailViewModel> = {}): AppointmentDetailViewModel {
  return {
    id: "appt-1",
    status: "scheduled",
    customerName: "Ana Pérez",
    customer: { first_name: "Ana", last_name: "Pérez" },
    start_time: `${TEST_DATE}T14:00:00-05:00`,
    end_time: `${TEST_DATE}T15:00:00-05:00`,
    subtotal_price: 25,
    discount_amount: 0,
    total_price: 25,
    completion_price_note: null,
    notes: "Llega temprano",
    timezone: SALON_TZ,
    items: [
      {
        id: "item-1",
        serviceId: "svc-corte",
        employeeId: "emp-1",
        serviceName: "Corte",
        serviceCategoryName: "Cabello",
        pricingMode: "fixed",
        employeeName: "Lucía Gómez",
        start_time: `${TEST_DATE}T14:00:00-05:00`,
        end_time: `${TEST_DATE}T15:00:00-05:00`,
        price: 25,
        discountAmount: 0,
      },
    ],
    ...overrides,
  };
}

function renderForm(appointment: AppointmentDetailViewModel = buildAppointment()) {
  const props = buildWizardProps();
  const mounted: MountedComponent = mountComponent(
    <ToastProvider>
      <AppointmentEditForm
        appointment={appointment}
        categories={props.categories}
        services={props.services}
        employees={props.employees}
        salonConfig={props.salonConfig}
        businessHours={props.businessHours}
      />
    </ToastProvider>
  );
  return mounted;
}

describe("AppointmentEditForm", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    router.push.mockReset();
    router.refresh.mockReset();
    vi.mocked(getOccupiedSlotsForEditDate).mockResolvedValue({});
    vi.mocked(updateAppointmentScheduleAction).mockResolvedValue({ ok: true, value: undefined });
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function render(appointment?: AppointmentDetailViewModel) {
    mounted = renderForm(appointment);
    return mounted.container;
  }

  it("carga la fecha, la hora y las notas de la cita existente", () => {
    const container = render();

    expect(byAriaLabel<HTMLInputElement>(container, "Fecha").value).toBe(TEST_DATE);
    expect(byAriaLabel<HTMLInputElement>(container, "Hora").value).toBe("14:00");
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("Llega temprano");
  });

  it("muestra el servicio y el profesional actuales de cada fila", () => {
    const container = render();

    expect(container.textContent).toContain("Servicio 1");
    expect(selectedLabelOf(container, "Servicio")).toBe("Corte (60 min)");
    expect(selectedLabelOf(container, "Profesional")).toBe("Lucía Gómez");
    expect(container.textContent).toContain(formatCurrency(25));
  });

  it("consulta la disponibilidad del día excluyendo esta misma cita", () => {
    render();

    expect(getOccupiedSlotsForEditDate).toHaveBeenCalledWith(TEST_DATE, "appt-1");
  });

  it("muestra el total de los servicios según el catálogo", () => {
    const container = render();

    expect(container.textContent).toContain(`Total: ${formatCurrency(WIZARD_SERVICES[0]!.price)}`);
  });

  it("deshabilita 'Guardar cambios' cuando el profesional ya no puede atender ese horario", async () => {
    const container = render(buildAppointment({
      items: [
        {
          id: "item-1",
          serviceId: "svc-corte",
          employeeId: "emp-no-existe",
          serviceName: "Corte",
          serviceCategoryName: "Cabello",
          pricingMode: "fixed",
          employeeName: "Desconocido",
          start_time: `${TEST_DATE}T14:00:00-05:00`,
          end_time: `${TEST_DATE}T15:00:00-05:00`,
          price: 25,
          discountAmount: 0,
        },
      ],
    }));
    await act(async () => undefined);

    expect(buttonWithText(container, "Guardar cambios").disabled).toBe(true);
  });

  it("abre la revisión final con fecha, horario, servicios, total y notas antes de guardar", async () => {
    const container = render();
    await act(async () => undefined);

    click(buttonWithText(container, "Guardar cambios"));

    expect(container.textContent).toContain("Revisa los cambios de la cita");
    expect(container.textContent).toContain("La cita todavía no se ha actualizado.");
    expect(container.textContent).toContain("2026");
    expect(container.textContent).toContain(" - ");
    expect(container.textContent).toContain("Corte");
    expect(container.textContent).toContain("Lucía Gómez");
    expect(container.textContent).toContain("Llega temprano");
    expect(container.textContent).toContain(formatCurrency(WIZARD_SERVICES[0]!.price));
  });

  it("vuelve al formulario desde la revisión sin guardar", async () => {
    const container = render();
    await act(async () => undefined);
    click(buttonWithText(container, "Guardar cambios"));

    click(buttonWithText(container, "Cancelar"));

    expect(container.textContent).not.toContain("Revisa los cambios de la cita");
    expect(byAriaLabel<HTMLInputElement>(container, "Fecha").value).toBe(TEST_DATE);
    expect(updateAppointmentScheduleAction).not.toHaveBeenCalled();
  });

  it("guarda el nuevo horario con el id de la cita, el inicio, las notas y las asignaciones", async () => {
    const container = render();
    await act(async () => undefined);
    setFieldValue(container.querySelector<HTMLTextAreaElement>("textarea")!, "Cambió de planes");
    click(buttonWithText(container, "Guardar cambios"));

    await clickAndSettle(buttonWithText(container, "Guardar"));
    // El envío calcula la clave de idempotencia de forma asíncrona (lento en CI).
    await vi.waitFor(() => expect(updateAppointmentScheduleAction).toHaveBeenCalledTimes(1));

    expect(updateAppointmentScheduleAction).toHaveBeenCalledTimes(1);
    const [prevState, formData] = vi.mocked(updateAppointmentScheduleAction).mock.calls[0] ?? [];
    expect(prevState).toBeNull();
    expect(formData?.get("appointment_id")).toBe("appt-1");
    // El inicio se interpreta en la zona del salón (America/Panama, UTC-5 sin horario de verano),
    // no en la del navegador: 14:00 en el salón son las 19:00 UTC en cualquier máquina.
    expect(formData?.get("start_time")).toBe(`${TEST_DATE}T19:00:00.000Z`);
    expect(formData?.get("notes")).toBe("Cambió de planes");
    expect(JSON.parse(String(formData?.get("assignments")))).toEqual([
      { service_id: "svc-corte", employee_id: "emp-1" },
    ]);
    expect(router.push).toHaveBeenCalledWith("/appointments");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("muestra el error si la cita no se pudo actualizar y permanece en la revisión", async () => {
    vi.mocked(updateAppointmentScheduleAction).mockResolvedValue({
      ok: false,
      error: "El horario choca con otra cita.",
    });
    const container = render();
    await act(async () => undefined);
    click(buttonWithText(container, "Guardar cambios"));

    await clickAndSettle(buttonWithText(container, "Guardar"));

    expect(container.textContent).toContain("El horario choca con otra cita.");
    expect(container.textContent).toContain("Revisa los cambios de la cita");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("agrega una fila nueva sin servicio, lo que impide guardar hasta completarla", async () => {
    const container = render();
    await act(async () => undefined);

    click(buttonWithText(container, "Agregar servicio"));

    expect(container.textContent).toContain("Servicio 2");
    expect(buttonWithText(container, "Guardar cambios").disabled).toBe(true);
  });

  it("quita un servicio solo cuando hay más de uno", async () => {
    const container = render(buildAppointment({
      items: [
        ...buildAppointment().items,
        {
          id: "item-2",
          serviceId: "svc-manicura",
          employeeId: "emp-2",
          serviceName: "Manicura",
          serviceCategoryName: "Uñas",
          pricingMode: "fixed",
          employeeName: "Marta Ruiz",
          start_time: `${TEST_DATE}T15:00:00-05:00`,
          end_time: `${TEST_DATE}T15:45:00-05:00`,
          price: 15,
          discountAmount: 0,
        },
      ],
    }));
    await act(async () => undefined);
    expect(container.textContent).toContain("Servicio 2");

    click(container.querySelector<HTMLButtonElement>('button[aria-label="Quitar servicio"]')!);

    expect(container.textContent).not.toContain("Servicio 2");
    expect(container.querySelector('button[aria-label="Quitar servicio"]')).toBeNull();
  });

  it("al cambiar de categoría limpia el servicio y el profesional de esa fila", async () => {
    const container = render();
    await act(async () => undefined);

    chooseOption(container, "Categoría", "Uñas");

    expect(selectedLabelOf(container, "Servicio")).toBe("Selecciona");
    expect(selectedLabelOf(container, "Profesional")).toBe("Selecciona");
  });

  it("ofrece solo los profesionales elegibles para el servicio de la fila", async () => {
    const container = render();
    await act(async () => undefined);

    chooseOption(container, "Servicio", "Tinte (90 min)");

    expect(selectedLabelOf(container, "Profesional")).toBe("Selecciona");
    expect(nativeOptionTexts(container, "Profesional")).toEqual(["Selecciona", "Lucía Gómez"]);
  });

  it("cambia la fecha a un día cerrado y bloquea el guardado", async () => {
    const container = render();
    await setFieldValueAndSettle(byAriaLabel<HTMLInputElement>(container, "Fecha"), "2026-10-18");

    // CONDUCTA ACTUAL (posible bug): el mensaje de día cerrado llega con mojibake (UTF-8 leído como Latin-1).
    expect(container.textContent).toContain("El salón está cerrado ese día.");
    expect(buttonWithText(container, "Guardar cambios").disabled).toBe(true);
  });

  it("CONDUCTA ACTUAL (posible bug): los textos con tildes del formulario se muestran con mojibake", async () => {
    // Literales con tildes codificados doblemente (Categoría, Horario del salón, ·).
    const container = render();
    await act(async () => undefined);

    expect(Array.from(container.querySelectorAll("label")).some((label) => label.textContent?.includes("Categoría"))).toBe(true);
    expect(container.textContent).toContain("Horario del salón: 08:00 - 18:00.");
    expect(container.textContent).toContain("·");
  });

  it("limita la hora al horario de apertura y cierre del salón del día", () => {
    const container = render();

    const time = byAriaLabel<HTMLInputElement>(container, "Hora");
    expect(time.getAttribute("data-min")).toBe("08:00");
    expect(time.getAttribute("data-max")).toBe("18:00");
  });

  it("cancelar en el formulario vuelve a la agenda sin guardar", async () => {
    const container = render();
    await act(async () => undefined);

    click(buttonWithText(container, "Cancelar"));

    expect(router.push).toHaveBeenCalledWith("/appointments");
    expect(updateAppointmentScheduleAction).not.toHaveBeenCalled();
  });

  it("reordena los servicios al soltar una fila sobre otra", async () => {
    const container = render(buildAppointment({
      items: [
        ...buildAppointment().items,
        {
          id: "item-2",
          serviceId: "svc-tinte",
          employeeId: "emp-1",
          serviceName: "Tinte",
          serviceCategoryName: "Cabello",
          pricingMode: "fixed",
          employeeName: "Lucía Gómez",
          start_time: `${TEST_DATE}T15:00:00-05:00`,
          end_time: `${TEST_DATE}T16:30:00-05:00`,
          price: 40,
          discountAmount: 0,
        },
      ],
    }));
    await act(async () => undefined);
    const [first, second] = Array.from(container.querySelectorAll<HTMLElement>('[draggable="true"]'));
    if (!first || !second) throw new Error("Faltan filas de servicio");
    expect(selectedLabelOf(first, "Servicio")).toBe("Corte (60 min)");

    act(() => {
      first.dispatchEvent(new Event("dragstart", { bubbles: true }));
    });
    act(() => {
      second.dispatchEvent(new Event("drop", { bubbles: true }));
    });

    const [reordered] = Array.from(container.querySelectorAll<HTMLElement>('[draggable="true"]'));
    expect(reordered ? selectedLabelOf(reordered, "Servicio") : "").toBe("Tinte (90 min)");
  });

  it("actualiza la nota interna de la cita", async () => {
    const container = render();
    await act(async () => undefined);

    setFieldValue(container.querySelector<HTMLTextAreaElement>("textarea")!, "Nueva nota");

    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("Nueva nota");
  });
});
