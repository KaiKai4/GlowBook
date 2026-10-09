// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  buttonWithText,
  chooseOption,
  click,
  fieldWithLabel,
  setFieldValue,
} from "@/test/ui-appointments-dom";
import { AppointmentCustomerStep } from "./appointment-customer-step";

const CUSTOMERS = [
  { id: "cust-1", name: "Ana Pérez" },
  { id: "cust-2", name: "Carlos Mora" },
];

type StepProps = Parameters<typeof AppointmentCustomerStep>[0];

function buildProps(overrides: Partial<StepProps> = {}): StepProps {
  return {
    customers: CUSTOMERS,
    mode: "existing",
    setMode: vi.fn(),
    customerId: "",
    setCustomerId: vi.fn(),
    newFirst: "",
    setNewFirst: vi.fn(),
    newLast: "",
    setNewLast: vi.fn(),
    newPhone: "",
    setNewPhone: vi.fn(),
    error: null,
    checkingPhone: false,
    onContinue: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

describe("AppointmentCustomerStep", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function render(overrides: Partial<StepProps> = {}) {
    const props = buildProps(overrides);
    mounted = mountComponent(<AppointmentCustomerStep {...props} />);
    return { container: mounted.container, props };
  }

  describe("cliente existente", () => {
    it("deshabilita 'Cliente existente' cuando el salón no tiene clientes", () => {
      const { container } = render({ customers: [] });

      expect(buttonWithText(container, "Cliente existente").disabled).toBe(true);
    });

    it("elige un cliente existente, limpia el error previo y habilita continuar", () => {
      const { container, props } = render({ customerId: "" });

      expect(buttonWithText(container, "Continuar").disabled).toBe(true);

      chooseOption(container, "Cliente", "Carlos Mora");

      expect(props.clearError).toHaveBeenCalled();
      expect(props.setCustomerId).toHaveBeenCalledWith("cust-2");
    });

    it("habilita continuar cuando ya hay un cliente seleccionado y lo dispara al pulsarlo", () => {
      const { container, props } = render({ customerId: "cust-1" });

      click(buttonWithText(container, "Continuar"));

      expect(props.onContinue).toHaveBeenCalledTimes(1);
    });

    it("no muestra los campos de cliente nuevo en este modo", () => {
      const { container } = render({ customerId: "cust-1" });

      expect(container.querySelector('input[type="tel"]')).toBeNull();
    });
  });

  describe("cliente nuevo", () => {
    it("cambia de modo y limpia el error al elegir cliente nuevo", () => {
      const { container, props } = render();

      click(buttonWithText(container, "Cliente nuevo"));

      expect(props.clearError).toHaveBeenCalled();
      expect(props.setMode).toHaveBeenCalledWith("new");
    });

    it("muestra nombre, apellido y celular opcional, y los reporta al escribir", () => {
      const { container, props } = render({ mode: "new", customers: [] });

      setFieldValue(fieldWithLabel(container, "Nombre"), "Luis");
      setFieldValue(fieldWithLabel(container, "Apellido"), "Soto");

      expect(props.setNewFirst).toHaveBeenCalledWith("Luis");
      expect(props.setNewLast).toHaveBeenCalledWith("Soto");
      expect(props.clearError).toHaveBeenCalled();
    });

    it("normaliza el celular: quita separadores y el prefijo de Panamá, y limita a 8 dígitos", () => {
      const { container, props } = render({ mode: "new", customers: [] });

      setFieldValue(fieldWithLabel(container, "Celular (opcional)"), "+507 6123-4567");

      expect(props.setNewPhone).toHaveBeenCalledWith("61234567");
    });

    it("muestra el celular normalizado que llega desde el padre", () => {
      const { container } = render({ mode: "new", customers: [], newPhone: "61234567" });

      expect(fieldWithLabel<HTMLInputElement>(container, "Celular (opcional)").value).toBe("61234567");
    });

    it("muestra el error de validación con formato de alerta", () => {
      const { container } = render({
        mode: "new",
        customers: [],
        error: "Nombre y apellido son obligatorios.",
      });

      expect(container.textContent).toContain("Nombre y apellido son obligatorios.");
    });

    it("siempre permite continuar en modo cliente nuevo para que el asistente valide", () => {
      const { container, props } = render({ mode: "new", customers: [] });

      click(buttonWithText(container, "Continuar"));

      expect(props.onContinue).toHaveBeenCalledTimes(1);
    });

    it("muestra el botón de continuar en carga mientras se verifica el celular", () => {
      const { container } = render({ mode: "new", customers: [], checkingPhone: true });

      expect(buttonWithText(container, "Continuar").disabled).toBe(true);
    });
  });
});
