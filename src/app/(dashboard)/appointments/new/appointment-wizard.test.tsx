// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppointmentAction, getOccupiedSlotsForDate } from "@/app/(dashboard)/appointments/actions";
import {
  checkCustomerPhoneAction,
  findOrCreateCustomerAction,
} from "@/app/(dashboard)/customers/actions";
import { phoneValidationMessage } from "@/infra/format/phone";
import { ToastProvider } from "@/components/ui/toast";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buildWizardProps, TEST_DATE } from "@/test/ui-appointments-fixtures";
import {
  buttonWithText,
  chooseOption,
  click,
  clickAndSettle,
  fieldWithLabel,
  setFieldValue,
  setFieldValueAndSettle,
  byAriaLabel,
} from "@/test/ui-appointments-dom";
import { AppointmentWizard } from "./appointment-wizard";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/ui/date-picker", () => import("@/test/ui-appointments-pickers"));
vi.mock("@/components/ui/time-picker", () => import("@/test/ui-appointments-pickers"));
vi.mock("@/app/(dashboard)/appointments/actions", () => ({
  createAppointmentAction: vi.fn(),
  getOccupiedSlotsForDate: vi.fn(),
}));
vi.mock("@/app/(dashboard)/customers/actions", () => ({
  checkCustomerPhoneAction: vi.fn(),
  findOrCreateCustomerAction: vi.fn(),
}));

const CUSTOMER_ID = "cust-1";

describe("AppointmentWizard", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    router.push.mockReset();
    router.refresh.mockReset();
    vi.mocked(getOccupiedSlotsForDate).mockResolvedValue({});
    vi.mocked(checkCustomerPhoneAction).mockResolvedValue({ exists: false });
    vi.mocked(findOrCreateCustomerAction).mockResolvedValue({ ok: true, value: "cust-temp" });
    vi.mocked(createAppointmentAction).mockResolvedValue({ ok: true, value: "appt-new" });
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function render(overrides: Parameters<typeof buildWizardProps>[0] = {}) {
    mounted = mountComponent(
      <ToastProvider>
        <AppointmentWizard {...buildWizardProps(overrides)} />
      </ToastProvider>
    );
    return mounted.container;
  }

  /** Lleva el asistente al paso de servicios con un cliente existente. */
  async function reachServicesStep(container: HTMLElement) {
    chooseOption(container, "Cliente", "Ana Pérez");
    click(buttonWithText(container, "Continuar"));
    await setFieldValueAndSettle(byAriaLabel<HTMLInputElement>(container, "Fecha"), TEST_DATE);
  }

  /** Completa una fila válida: corte de cabello con Lucía Gómez a las 09:00. */
  function fillValidRow(container: HTMLElement) {
    chooseOption(container, "Categoria", "Cabello");
    chooseOption(container, "Servicio", "Corte (60min)");
    chooseOption(container, "Profesional", "Lucía Gómez");
  }

  describe("paso 1: cliente", () => {
    it("empieza con cliente existente cuando el salón tiene clientes", () => {
      const container = render();

      expect(buttonWithText(container, "Cliente existente").className).toContain("text-brand-700");
      expect(buttonWithText(container, "Continuar").disabled).toBe(true);
    });

    it("empieza con cliente nuevo cuando el salón no tiene clientes", () => {
      const container = render({ customers: [] });

      expect(buttonWithText(container, "Cliente nuevo").className).toContain("text-brand-700");
      expect(fieldWithLabel(container, "Nombre")).toBeInstanceOf(HTMLInputElement);
    });

    it("no avanza con un cliente nuevo sin nombre completo", () => {
      const container = render({ customers: [] });
      setFieldValue(fieldWithLabel(container, "Nombre"), "Luis");

      click(buttonWithText(container, "Continuar"));

      expect(container.textContent).toContain("Nombre y apellido son obligatorios.");
      expect(checkCustomerPhoneAction).not.toHaveBeenCalled();
      expect(fieldWithLabel(container, "Nombre")).toBeInstanceOf(HTMLInputElement);
    });

    it("rechaza un celular inválido sin consultar si ya existe", () => {
      const container = render({ customers: [] });
      setFieldValue(fieldWithLabel(container, "Nombre"), "Luis");
      setFieldValue(fieldWithLabel(container, "Apellido"), "Soto");
      setFieldValue(fieldWithLabel(container, "Celular (opcional)"), "1234");

      click(buttonWithText(container, "Continuar"));

      expect(container.textContent).toContain(phoneValidationMessage());
      expect(checkCustomerPhoneAction).not.toHaveBeenCalled();
    });

    it("no permite crear un cliente cuyo celular ya está registrado", async () => {
      vi.mocked(checkCustomerPhoneAction).mockResolvedValue({ exists: true, archived: false });
      const container = render({ customers: [] });
      setFieldValue(fieldWithLabel(container, "Nombre"), "Luis");
      setFieldValue(fieldWithLabel(container, "Apellido"), "Soto");
      setFieldValue(fieldWithLabel(container, "Celular (opcional)"), "61234567");

      await clickAndSettle(buttonWithText(container, "Continuar"));

      expect(checkCustomerPhoneAction).toHaveBeenCalledWith("61234567");
      expect(container.textContent).toContain(
        "Este numero ya esta registrado. Buscalo en Cliente existente."
      );
      expect(fieldWithLabel(container, "Nombre")).toBeInstanceOf(HTMLInputElement);
    });

    it("indica restaurar el cliente cuando el celular pertenece a uno archivado", async () => {
      vi.mocked(checkCustomerPhoneAction).mockResolvedValue({ exists: true, archived: true });
      const container = render({ customers: [] });
      setFieldValue(fieldWithLabel(container, "Nombre"), "Luis");
      setFieldValue(fieldWithLabel(container, "Apellido"), "Soto");
      setFieldValue(fieldWithLabel(container, "Celular (opcional)"), "61234567");

      await clickAndSettle(buttonWithText(container, "Continuar"));

      expect(container.textContent).toContain("Restauralo desde Clientes para conservar su historial.");
    });

    it("avanza a servicios con un cliente nuevo sin celular, sin consultar el teléfono", () => {
      const container = render({ customers: [] });
      setFieldValue(fieldWithLabel(container, "Nombre"), "Luis");
      setFieldValue(fieldWithLabel(container, "Apellido"), "Soto");

      click(buttonWithText(container, "Continuar"));

      expect(checkCustomerPhoneAction).not.toHaveBeenCalled();
      expect(byAriaLabel(container, "Fecha")).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe("paso 2: servicios y horario", () => {
    it("ajusta la hora al abrir el salón cuando la fecha elegida exige otro horario", async () => {
      const container = render();
      chooseOption(container, "Cliente", "Ana Pérez");
      click(buttonWithText(container, "Continuar"));
      setFieldValue(byAriaLabel<HTMLInputElement>(container, "Hora de inicio"), "19:30");

      await setFieldValueAndSettle(byAriaLabel<HTMLInputElement>(container, "Fecha"), TEST_DATE);

      expect(byAriaLabel<HTMLInputElement>(container, "Hora de inicio").value).toBe("08:00");
      expect(getOccupiedSlotsForDate).toHaveBeenCalledWith(TEST_DATE);
    });

    it("no permite continuar en un día en que el salón está cerrado", async () => {
      const container = render();
      chooseOption(container, "Cliente", "Ana Pérez");
      click(buttonWithText(container, "Continuar"));

      await setFieldValueAndSettle(byAriaLabel<HTMLInputElement>(container, "Fecha"), "2026-10-18");

      expect(container.textContent).toContain("El salon esta cerrado ese día.");
      expect(buttonWithText(container, "Continuar").disabled).toBe(true);
    });

    it("mantiene deshabilitado continuar hasta que cada servicio tenga categoría, servicio y profesional", async () => {
      const container = render();
      await reachServicesStep(container);

      expect(buttonWithText(container, "Continuar").disabled).toBe(true);
      fillValidRow(container);

      expect(buttonWithText(container, "Continuar").disabled).toBe(false);
    });

    it("agrega un segundo servicio encadenado tras el primero", async () => {
      const container = render();
      await reachServicesStep(container);
      fillValidRow(container);

      click(buttonWithText(container, "Agregar otro servicio"));

      expect(container.textContent).toContain("Servicio 2");
      expect(buttonWithText(container, "Continuar").disabled).toBe(true);
    });

    it("regresa al paso de cliente con 'Atras'", async () => {
      const container = render();
      await reachServicesStep(container);

      click(buttonWithText(container, "Atras"));

      expect(container.textContent).toContain("Seleccionar cliente");
      expect(container.querySelector('input[aria-label="Fecha"]')).toBeNull();
      // El cliente elegido se conserva al volver.
      expect(buttonWithText(container, "Continuar").disabled).toBe(false);
    });
  });

  describe("paso 3: confirmación", () => {
    async function reachSummary(container: HTMLElement) {
      await reachServicesStep(container);
      fillValidRow(container);
      click(buttonWithText(container, "Continuar"));
    }

    it("crea la cita con el cliente, el inicio exacto y las asignaciones de servicio y profesional", async () => {
      const container = render();
      await reachSummary(container);
      setFieldValue(fieldWithLabel(container, "Notas (opcional)"), "Sin lácteos");

      await clickAndSettle(buttonWithText(container, "Confirmar cita"));

      expect(createAppointmentAction).toHaveBeenCalledTimes(1);
      const [prevState, formData] = vi.mocked(createAppointmentAction).mock.calls[0] ?? [];
      expect(prevState).toBeNull();
      expect(formData?.get("customer_id")).toBe(CUSTOMER_ID);
      // El inicio se interpreta en la zona del salón (America/Panama, UTC-5 sin horario de verano),
      // no en la del navegador: 09:00 en el salón son las 14:00 UTC en cualquier máquina.
      expect(formData?.get("start_time")).toBe(`${TEST_DATE}T14:00:00.000Z`);
      expect(formData?.get("notes")).toBe("Sin lácteos");
      expect(JSON.parse(String(formData?.get("assignments")))).toEqual([
        { service_id: "svc-corte", employee_id: "emp-1" },
      ]);
      expect(router.push).toHaveBeenCalledWith("/appointments");
      expect(router.refresh).toHaveBeenCalledTimes(1);
    });

    it("muestra el error si la cita no se puede crear y se queda en el resumen", async () => {
      vi.mocked(createAppointmentAction).mockResolvedValue({ ok: false, error: "Ese horario ya no está disponible." });
      const container = render();
      await reachSummary(container);

      await clickAndSettle(buttonWithText(container, "Confirmar cita"));

      expect(container.textContent).toContain("Ese horario ya no está disponible.");
      expect(router.push).not.toHaveBeenCalled();
      expect(router.refresh).not.toHaveBeenCalled();
    });

    it("crea primero el cliente nuevo y usa su id en la cita", async () => {
      const container = render({ customers: [] });
      setFieldValue(fieldWithLabel(container, "Nombre"), "Luis");
      setFieldValue(fieldWithLabel(container, "Apellido"), "Soto");
      click(buttonWithText(container, "Continuar"));
      await setFieldValueAndSettle(byAriaLabel<HTMLInputElement>(container, "Fecha"), TEST_DATE);
      fillValidRow(container);
      click(buttonWithText(container, "Continuar"));

      await clickAndSettle(buttonWithText(container, "Confirmar cita"));

      expect(findOrCreateCustomerAction).toHaveBeenCalledWith("Luis", "Soto", undefined);
      expect(vi.mocked(createAppointmentAction).mock.calls[0]?.[1]?.get("customer_id")).toBe("cust-temp");
    });

    it("no crea la cita si no se pudo registrar el cliente nuevo", async () => {
      vi.mocked(findOrCreateCustomerAction).mockResolvedValue({ ok: false, error: "No tienes permiso para crear clientes." });
      const container = render({ customers: [] });
      setFieldValue(fieldWithLabel(container, "Nombre"), "Luis");
      setFieldValue(fieldWithLabel(container, "Apellido"), "Soto");
      click(buttonWithText(container, "Continuar"));
      await setFieldValueAndSettle(byAriaLabel<HTMLInputElement>(container, "Fecha"), TEST_DATE);
      fillValidRow(container);
      click(buttonWithText(container, "Continuar"));

      await clickAndSettle(buttonWithText(container, "Confirmar cita"));

      expect(container.textContent).toContain("No tienes permiso para crear clientes.");
      expect(createAppointmentAction).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
    });
  });
});
