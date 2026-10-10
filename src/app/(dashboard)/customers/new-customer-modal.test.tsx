// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  blur,
  buttonWithText,
  click,
  fieldByLabel,
  flushAsync,
  setFieldValue,
} from "@/test/ui-people-dom";
import {
  createCustomerAction,
  findArchivedCustomerByContactAction,
  reactivateCustomerAction,
} from "./actions";
import { NewCustomerModal } from "./new-customer-modal";

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

function openModal(container: HTMLElement): void {
  click(buttonWithText(container, "Nuevo cliente"));
}

function dialogIsOpen(): boolean {
  return document.body.querySelector('[role="dialog"]') !== null;
}

describe("NewCustomerModal", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.refresh.mockReset();
    vi.mocked(createCustomerAction).mockReset();
    vi.mocked(findArchivedCustomerByContactAction).mockReset();
    vi.mocked(findArchivedCustomerByContactAction).mockResolvedValue(null);
    vi.mocked(reactivateCustomerAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra solo el botón Nuevo cliente hasta que se abre el diálogo", () => {
    mounted = mountComponent(<NewCustomerModal />);

    expect(dialogIsOpen()).toBe(false);
    openModal(mounted.container);
    expect(dialogIsOpen()).toBe(true);
    expect(document.body.querySelector('[role="dialog"] h2')?.textContent).toBe("Nuevo cliente");
  });

  it("válida que nombre y apellido no estén vacíos antes de crear", () => {
    mounted = mountComponent(<NewCustomerModal />);
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Nombre"), "Maria");
    click(buttonWithText(document.body, "Crear cliente"));

    expect(document.body.textContent).toContain("Nombre y apellido son obligatorios.");
    expect(createCustomerAction).not.toHaveBeenCalled();
  });

  it("crea el cliente con los datos recortados y normalizados y refresca la vista", async () => {
    vi.mocked(createCustomerAction).mockResolvedValue({ ok: true, value: "cust-9" });
    mounted = mountComponent(<NewCustomerModal />);
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Nombre"), " Maria ");
    setFieldValue(fieldByLabel(document.body, "Apellido"), "Garcia");
    setFieldValue(fieldByLabel(document.body, "Celular"), "+507 6000 1234");
    setFieldValue(fieldByLabel(document.body, "Email (opcional)"), "maria@example.com");
    click(buttonWithText(document.body, "Crear cliente"));
    await flushAsync();

    expect(createCustomerAction).toHaveBeenCalledTimes(1);
    const [previous, formData] = vi.mocked(createCustomerAction).mock.calls[0] ?? [];
    expect(previous).toBeNull();
    expect(formData?.get("first_name")).toBe("Maria");
    expect(formData?.get("last_name")).toBe("Garcia");
    expect(formData?.get("phone")).toBe("60001234");
    expect(formData?.get("email")).toBe("maria@example.com");
    expect(formData?.has("notes")).toBe(false);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(dialogIsOpen()).toBe(false);
  });

  it("incluye las notas cuando el usuario las escribe", async () => {
    vi.mocked(createCustomerAction).mockResolvedValue({ ok: true, value: "cust-9" });
    mounted = mountComponent(<NewCustomerModal />);
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Nombre"), "Lu");
    setFieldValue(fieldByLabel(document.body, "Apellido"), "Ruiz");
    setFieldValue(fieldByLabel(document.body, "Notas (opcional)"), "Alergia al amoniaco");
    click(buttonWithText(document.body, "Crear cliente"));
    await flushAsync();

    const formData = vi.mocked(createCustomerAction).mock.calls[0]?.[1];
    expect(formData?.get("notes")).toBe("Alergia al amoniaco");
  });

  it("muestra el error de creación y mantiene el diálogo abierto", async () => {
    vi.mocked(createCustomerAction).mockResolvedValue({ ok: false, error: "Has alcanzado el límite de clientes de tu plan" });
    mounted = mountComponent(<NewCustomerModal />);
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Nombre"), "Lu");
    setFieldValue(fieldByLabel(document.body, "Apellido"), "Ruiz");
    click(buttonWithText(document.body, "Crear cliente"));
    await flushAsync();

    expect(document.body.textContent).toContain("Has alcanzado el límite de clientes de tu plan");
    expect(dialogIsOpen()).toBe(true);
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("al salir del celular busca un cliente archivado con ese contacto y ofrece restaurarlo", async () => {
    vi.mocked(findArchivedCustomerByContactAction).mockResolvedValue({
      id: "cust-old",
      name: "Ana Vega",
      phone: "60001234",
      email: null,
    });
    mounted = mountComponent(<NewCustomerModal />);
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Celular"), "60001234");
    blur(fieldByLabel(document.body, "Celular"));
    await flushAsync();

    expect(findArchivedCustomerByContactAction).toHaveBeenCalledWith("60001234", "");
    expect(document.body.textContent).toContain("Ya existe un cliente con esos datos: Ana Vega");
    expect(buttonWithText(document.body, "Crear cliente").disabled).toBe(true);
  });

  it("restaura el cliente archivado coincidente y refresca la vista", async () => {
    vi.mocked(findArchivedCustomerByContactAction).mockResolvedValue({
      id: "cust-old",
      name: "Ana Vega",
      phone: null,
      email: "ana@example.com",
    });
    vi.mocked(reactivateCustomerAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<NewCustomerModal />);
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Email (opcional)"), "ana@example.com");
    blur(fieldByLabel(document.body, "Email (opcional)"));
    await flushAsync();
    click(buttonWithText(document.body, "Restaurar cliente"));
    await flushAsync();

    expect(reactivateCustomerAction).toHaveBeenCalledWith("cust-old");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(dialogIsOpen()).toBe(false);
  });

  it("descarta la coincidencia archivada al cambiar el contacto de nuevo", async () => {
    vi.mocked(findArchivedCustomerByContactAction).mockResolvedValue({
      id: "cust-old",
      name: "Ana Vega",
      phone: "60001234",
      email: null,
    });
    mounted = mountComponent(<NewCustomerModal />);
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Celular"), "60001234");
    blur(fieldByLabel(document.body, "Celular"));
    await flushAsync();
    setFieldValue(fieldByLabel(document.body, "Celular"), "6000123");

    expect(document.body.textContent).not.toContain("Ya existe un cliente con esos datos");
    expect(buttonWithText(document.body, "Crear cliente").disabled).toBe(false);
  });

  it("cancela y reinicia el formulario al reabrirlo", () => {
    mounted = mountComponent(<NewCustomerModal />);
    openModal(mounted.container);
    setFieldValue(fieldByLabel(document.body, "Nombre"), "Maria");

    click(buttonWithText(document.body, "Cancelar"));
    expect(dialogIsOpen()).toBe(false);

    openModal(mounted.container);
    expect(fieldByLabel(document.body, "Nombre").value).toBe("");
  });
});
