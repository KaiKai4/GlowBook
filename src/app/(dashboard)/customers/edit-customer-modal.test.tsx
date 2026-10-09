// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  buttonWithAriaLabel,
  buttonWithText,
  click,
  fieldByLabel,
  flushAsync,
  setFieldValue,
} from "@/test/ui-people-dom";
import { deleteCustomerAction, updateCustomerAction } from "./actions";
import { EditCustomerModal } from "./edit-customer-modal";

const routerMock = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("./actions", () => ({
  createCustomerAction: vi.fn(),
  checkCustomerPhoneAction: vi.fn(),
  findArchivedCustomerByContactAction: vi.fn(),
  reactivateCustomerAction: vi.fn(),
  updateCustomerAction: vi.fn(),
  deleteCustomerAction: vi.fn(),
}));

const CUSTOMER = {
  id: "cust-1",
  first_name: "Ana",
  last_name: "Vega",
  phone: "60001234",
  email: "ana@example.com",
  notes: "Prefiere citas por la mañana",
};

describe("EditCustomerModal", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.refresh.mockReset();
    vi.mocked(updateCustomerAction).mockReset();
    vi.mocked(deleteCustomerAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("precarga los datos del cliente en el formulario", () => {
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={vi.fn()} />);

    expect(fieldByLabel(document.body, "Nombre").value).toBe("Ana");
    expect(fieldByLabel(document.body, "Apellido").value).toBe("Vega");
    expect(fieldByLabel(document.body, "Celular").value).toBe("60001234");
    expect(fieldByLabel(document.body, "Email").value).toBe("ana@example.com");
    expect(fieldByLabel(document.body, "Notas (opcional)").value).toBe("Prefiere citas por la mañana");
  });

  it("precarga campos vacíos cuando el cliente no tiene teléfono, correo ni notas", () => {
    mounted = mountComponent(
      <EditCustomerModal customer={{ ...CUSTOMER, phone: null, email: null, notes: null }} open onClose={vi.fn()} />
    );

    expect(fieldByLabel(document.body, "Celular").value).toBe("");
    expect(fieldByLabel(document.body, "Email").value).toBe("");
    expect(fieldByLabel(document.body, "Notas (opcional)").value).toBe("");
  });

  it("normaliza el celular al formato local de Panamá mientras se escribe", () => {
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={vi.fn()} />);

    setFieldValue(fieldByLabel(document.body, "Celular"), "+507 6123-4567");

    expect(fieldByLabel(document.body, "Celular").value).toBe("61234567");
  });

  it("rechaza guardar sin nombre o apellido y no llama a la acción", () => {
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={vi.fn()} />);

    setFieldValue(fieldByLabel(document.body, "Nombre"), "   ");
    click(buttonWithText(document.body, "Guardar cambios"));

    expect(document.body.textContent).toContain("Nombre y apellido son obligatorios.");
    expect(updateCustomerAction).not.toHaveBeenCalled();
  });

  it("guarda los cambios con los datos recortados y cierra al tener éxito", async () => {
    vi.mocked(updateCustomerAction).mockResolvedValue({ ok: true, value: undefined });
    const onClose = vi.fn();
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={onClose} />);

    setFieldValue(fieldByLabel(document.body, "Nombre"), "  Ana María ");
    setFieldValue(fieldByLabel(document.body, "Email"), "");
    click(buttonWithText(document.body, "Guardar cambios"));
    await flushAsync();

    expect(updateCustomerAction).toHaveBeenCalledTimes(1);
    const [customerId, , formData] = vi.mocked(updateCustomerAction).mock.calls[0] ?? [];
    expect(customerId).toBe("cust-1");
    expect(formData?.get("first_name")).toBe("Ana María");
    expect(formData?.get("last_name")).toBe("Vega");
    expect(formData?.get("phone")).toBe("60001234");
    expect(formData?.has("email")).toBe(false);
    expect(formData?.get("notes")).toBe("Prefiere citas por la mañana");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("muestra el error de la acción y mantiene el modal abierto", async () => {
    vi.mocked(updateCustomerAction).mockResolvedValue({ ok: false, error: "El correo ya está registrado" });
    const onClose = vi.fn();
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={onClose} />);

    click(buttonWithText(document.body, "Guardar cambios"));
    await flushAsync();

    expect(document.body.textContent).toContain("El correo ya está registrado");
    expect(onClose).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("pide confirmación antes de archivar y permite volver atrás sin borrar nada", () => {
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={vi.fn()} />);

    click(buttonWithText(document.body, "Eliminar"));
    expect(document.body.textContent).toContain("¿Quieres archivar a Ana Vega?");

    click(buttonWithText(document.body, "Volver"));

    expect(document.body.textContent).not.toContain("¿Quieres archivar a Ana Vega?");
    expect(deleteCustomerAction).not.toHaveBeenCalled();
  });

  it("archiva el cliente tras confirmar, cierra el modal y refresca la vista", async () => {
    vi.mocked(deleteCustomerAction).mockResolvedValue({ ok: true, value: { outcome: "archived", message: "Cliente archivado." } });
    const onClose = vi.fn();
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={onClose} />);

    click(buttonWithText(document.body, "Eliminar"));
    click(buttonWithText(document.body, "Archivar"));
    await flushAsync();

    expect(deleteCustomerAction).toHaveBeenCalledWith("cust-1");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("muestra el error de archivado y mantiene la confirmación abierta", async () => {
    // CONDUCTA ACTUAL (posible bug): el error se guarda en el estado del diálogo de edición, que queda
    // debajo del diálogo de confirmación; el usuario solo ve la confirmación sin el motivo del fallo.
    vi.mocked(deleteCustomerAction).mockResolvedValue({ ok: false, error: "El cliente tiene citas pendientes" });
    const onClose = vi.fn();
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={onClose} />);

    click(buttonWithText(document.body, "Eliminar"));
    click(buttonWithText(document.body, "Archivar"));
    await flushAsync();

    expect(document.body.textContent).toContain("El cliente tiene citas pendientes");
    expect(document.body.textContent).toContain("¿Quieres archivar a Ana Vega?");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancela la edición sin llamar a ninguna acción", () => {
    const onClose = vi.fn();
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={onClose} />);

    click(buttonWithText(document.body, "Cancelar"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(updateCustomerAction).not.toHaveBeenCalled();
  });

  it("no cierra el modal de edición con la X mientras se guardan los cambios", () => {
    vi.mocked(updateCustomerAction).mockReturnValue(new Promise<never>(() => undefined));
    const onClose = vi.fn();
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={onClose} />);

    click(buttonWithText(document.body, "Guardar cambios"));
    click(buttonWithAriaLabel(document.body, "Cerrar"));

    expect(onClose).not.toHaveBeenCalled();
    expect(fieldByLabel(document.body, "Nombre").value).toBe("Ana");
  });

  it("envía los cambios de apellido y notas, y omite el teléfono cuando se borra", async () => {
    vi.mocked(updateCustomerAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={vi.fn()} />);

    setFieldValue(fieldByLabel(document.body, "Apellido"), "Vega Soto");
    setFieldValue(fieldByLabel(document.body, "Celular"), "");
    setFieldValue(fieldByLabel(document.body, "Notas (opcional)"), "Sin azúcar en el café");
    click(buttonWithText(document.body, "Guardar cambios"));
    await flushAsync();

    const formData = vi.mocked(updateCustomerAction).mock.calls[0]?.[2];
    expect(formData?.get("last_name")).toBe("Vega Soto");
    expect(formData?.has("phone")).toBe(false);
    expect(formData?.get("notes")).toBe("Sin azúcar en el café");
  });

  it("cierra la confirmación de archivado con su X y la deja abierta mientras archiva", async () => {
    vi.mocked(deleteCustomerAction).mockReturnValue(new Promise<never>(() => undefined));
    mounted = mountComponent(<EditCustomerModal customer={CUSTOMER} open onClose={vi.fn()} />);

    click(buttonWithText(document.body, "Eliminar"));
    const closeButtons = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>('button[aria-label="Cerrar"]'));
    click(closeButtons()[1] ?? missingCloseButton());
    expect(document.body.textContent).not.toContain("¿Quieres archivar a Ana Vega?");

    click(buttonWithText(document.body, "Eliminar"));
    click(buttonWithText(document.body, "Archivar"));
    click(closeButtons()[1] ?? missingCloseButton());

    expect(document.body.textContent).toContain("¿Quieres archivar a Ana Vega?");
  });
});

function missingCloseButton(): HTMLButtonElement {
  throw new Error("falta el botón Cerrar de la confirmación");
}
