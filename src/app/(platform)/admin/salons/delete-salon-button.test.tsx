// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/infra/result";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { changeFieldValue, clickElement, flushAsync, getButtonByText } from "@/test/ui-admin-dom";
import { deleteSalonAction } from "../actions";
import { DeleteSalonButton } from "./delete-salon-button";

const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("../actions", () => ({ deleteSalonAction: vi.fn() }));

const SALON_ID = "7f1c2e3a-0000-4000-8000-000000000001";

function dialogOf(container: HTMLElement): HTMLElement {
  const dialog = container.ownerDocument.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error("Diálogo no abierto");
  return dialog;
}

function confirmationInput(container: HTMLElement): HTMLInputElement {
  const input = dialogOf(container).querySelector<HTMLInputElement>("input");
  if (!input) throw new Error("Campo de confirmación no encontrado");
  return input;
}

describe("DeleteSalonButton", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.refresh.mockReset();
    vi.mocked(deleteSalonAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("abre el diálogo con el nombre del salón y su ID", () => {
    mounted = mountComponent(<DeleteSalonButton salonId={SALON_ID} salonName="Salón Luna" />);
    expect(mounted.container.ownerDocument.querySelector('[role="dialog"]')).toBeNull();

    clickElement(getButtonByText(mounted.container, "Eliminar"));

    const dialog = dialogOf(mounted.container);
    expect(dialog.textContent).toContain('Esta acción eliminará permanentemente "Salón Luna"');
    expect(dialog.textContent).toContain(SALON_ID);
  });

  it("mantiene deshabilitado el borrado hasta escribir exactamente el ID del salón", () => {
    mounted = mountComponent(<DeleteSalonButton salonId={SALON_ID} salonName="Salón Luna" />);
    clickElement(getButtonByText(mounted.container, "Eliminar"));

    expect(getButtonByText(dialogOf(mounted.container), "Eliminar definitivamente").disabled).toBe(true);

    changeFieldValue(confirmationInput(mounted.container), "salon-equivocado");
    expect(getButtonByText(dialogOf(mounted.container), "Eliminar definitivamente").disabled).toBe(true);

    changeFieldValue(confirmationInput(mounted.container), `  ${SALON_ID}  `);
    expect(getButtonByText(dialogOf(mounted.container), "Eliminar definitivamente").disabled).toBe(false);
  });

  it("elimina con el ID sin espacios, refresca la ruta y cierra el diálogo", async () => {
    vi.mocked(deleteSalonAction).mockResolvedValue(ok(undefined));
    mounted = mountComponent(<DeleteSalonButton salonId={SALON_ID} salonName="Salón Luna" />);
    clickElement(getButtonByText(mounted.container, "Eliminar"));
    changeFieldValue(confirmationInput(mounted.container), ` ${SALON_ID} `);

    clickElement(getButtonByText(dialogOf(mounted.container), "Eliminar definitivamente"));
    await flushAsync();

    expect(deleteSalonAction).toHaveBeenCalledWith(SALON_ID, SALON_ID);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(mounted.container.ownerDocument.querySelector('[role="dialog"]')).toBeNull();
  });

  it("muestra el error si la eliminación falla y deja el diálogo abierto", async () => {
    vi.mocked(deleteSalonAction).mockResolvedValue(err("El salón tiene un bloqueo activo."));
    mounted = mountComponent(<DeleteSalonButton salonId={SALON_ID} salonName="Salón Luna" />);
    clickElement(getButtonByText(mounted.container, "Eliminar"));
    changeFieldValue(confirmationInput(mounted.container), SALON_ID);

    clickElement(getButtonByText(dialogOf(mounted.container), "Eliminar definitivamente"));
    await flushAsync();

    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(dialogOf(mounted.container).textContent).toContain("El salón tiene un bloqueo activo.");
  });

  it("al cancelar cierra el diálogo y descarta lo escrito en la confirmación", () => {
    mounted = mountComponent(<DeleteSalonButton salonId={SALON_ID} salonName="Salón Luna" />);
    clickElement(getButtonByText(mounted.container, "Eliminar"));
    changeFieldValue(confirmationInput(mounted.container), SALON_ID);

    clickElement(getButtonByText(dialogOf(mounted.container), "Cancelar"));
    expect(mounted.container.ownerDocument.querySelector('[role="dialog"]')).toBeNull();

    clickElement(getButtonByText(mounted.container, "Eliminar"));
    expect(confirmationInput(mounted.container).value).toBe("");
    expect(deleteSalonAction).not.toHaveBeenCalled();
  });
});
