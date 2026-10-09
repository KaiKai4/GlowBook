// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  clickElement,
  findButtonByText,
  flushAsync,
  requireElement,
  setFieldValue,
  submitFormAsync,
} from "@/test/ui-shared-dom";
import { createRoleAction, deleteRoleAction, updateRolePermissionsAction } from "./actions";
import { RolesManager } from "./roles-manager";

vi.mock("./actions", () => ({
  createRoleAction: vi.fn(),
  updateRolePermissionsAction: vi.fn(),
  deleteRoleAction: vi.fn(),
}));

const createMock = vi.mocked(createRoleAction);
const updateMock = vi.mocked(updateRolePermissionsAction);
const deleteMock = vi.mocked(deleteRoleAction);

const ALL_PERMISSIONS = [{ id: "p1", key: "customers.manage", description: "Gestionar clientes" }];

const ROLES = [
  {
    id: "role-owner",
    name: "Propietario",
    is_system: true,
    permissionKeys: ["customers.manage"],
  },
  {
    id: "role-stylist",
    name: "Estilista",
    is_system: false,
    permissionKeys: ["customers.manage"],
  },
];

function checkboxFor(container: HTMLElement, text: string): HTMLInputElement {
  const label = Array.from(container.querySelectorAll("label")).find((candidate) => candidate.textContent?.includes(text));
  const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error(`Falta el permiso ${text}`);
  return input;
}

function stylistCard(container: HTMLElement): HTMLElement {
  const title = Array.from(container.querySelectorAll("h3")).find((node) => node.textContent === "Estilista");
  const card = title?.closest<HTMLElement>("div.rounded-xl");
  if (!card) throw new Error("Falta la tarjeta de Estilista");
  return card;
}

describe("RolesManager", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("un rol del sistema muestra el aviso de permisos fijos; solo los roles personalizados se pueden eliminar", () => {
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);

    const owner = Array.from(mounted.container.querySelectorAll<HTMLElement>("div.rounded-xl")).find((card) =>
      card.querySelector("h3")?.textContent === "Propietario"
    );
    if (!owner) throw new Error("Falta la tarjeta del propietario");
    expect(owner.textContent).toContain("Este rol siempre tiene todos los permisos del salón");
    expect(owner.querySelector('input[type="checkbox"]')).toBeNull();
    expect(owner.querySelector('button[aria-label="Eliminar rol"]')).toBeNull();
    expect(mounted.container.querySelectorAll('button[aria-label="Eliminar rol"]')).toHaveLength(1);
  });

  it("un rol personalizado muestra sus permisos marcados", () => {
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);

    expect(checkboxFor(stylistCard(mounted.container), "Gestionar clientes").checked).toBe(true);
    expect(checkboxFor(stylistCard(mounted.container), "Enviar recordatorios").checked).toBe(false);
  });

  it("sin cambios el botón Guardar está deshabilitado; al marcar un permiso se habilita", () => {
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);
    const card = stylistCard(mounted.container);
    const save = findButtonByText(card, "Guardar cambios");
    expect(save.disabled).toBe(true);

    clickElement(checkboxFor(card, "Enviar recordatorios"));

    expect(findButtonByText(card, "Guardar cambios").disabled).toBe(false);
  });

  it("desmarcar y volver a marcar el mismo permiso deja el rol sin cambios pendientes", () => {
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);
    const card = stylistCard(mounted.container);

    clickElement(checkboxFor(card, "Gestionar clientes"));
    expect(findButtonByText(card, "Guardar cambios").disabled).toBe(false);
    clickElement(checkboxFor(card, "Gestionar clientes"));

    expect(findButtonByText(card, "Guardar cambios").disabled).toBe(true);
  });

  it("guardar envía el id del rol y los permisos elegidos como JSON", async () => {
    updateMock.mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);
    const card = stylistCard(mounted.container);
    clickElement(checkboxFor(card, "Enviar recordatorios"));

    clickElement(findButtonByText(card, "Guardar cambios"));
    await flushAsync();

    expect(updateMock).toHaveBeenCalledTimes(1);
    const formData = updateMock.mock.calls[0]?.[1];
    expect(formData?.get("role_id")).toBe("role-stylist");
    expect(JSON.parse(String(formData?.get("permission_keys")))).toEqual([
      "customers.manage",
      "reminders.send",
    ]);
  });

  it("si guardar falla muestra el motivo junto al botón", async () => {
    updateMock.mockResolvedValue({ ok: false, error: "No tienes permiso para editar roles" });
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);
    const card = stylistCard(mounted.container);
    clickElement(checkboxFor(card, "Enviar recordatorios"));

    clickElement(findButtonByText(card, "Guardar cambios"));
    await flushAsync();

    expect(card.textContent).toContain("No tienes permiso para editar roles");
  });

  it("eliminar un rol personalizado pide confirmación y luego llama a la acción con su id", async () => {
    deleteMock.mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);

    clickElement(requireElement<HTMLButtonElement>(stylistCard(mounted.container), 'button[aria-label="Eliminar rol"]'));
    expect(deleteMock).not.toHaveBeenCalled();

    clickElement(findButtonByText(document.body, "Eliminar"));
    await flushAsync();

    expect(deleteMock).toHaveBeenCalledWith("role-stylist");
  });

  it("si eliminar el rol falla muestra el error y no lo da por eliminado", async () => {
    deleteMock.mockResolvedValue({ ok: false, error: "El rol tiene colaboradores activos" });
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);

    clickElement(requireElement<HTMLButtonElement>(stylistCard(mounted.container), 'button[aria-label="Eliminar rol"]'));
    clickElement(findButtonByText(document.body, "Eliminar"));
    await flushAsync();

    expect(document.body.textContent).toContain("El rol tiene colaboradores activos");
  });

  it("Nuevo rol abre el diálogo y Cancelar lo cierra sin crear nada", () => {
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);

    clickElement(findButtonByText(mounted.container, "Nuevo rol"));
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Nuevo rol");

    clickElement(findButtonByText(document.body, "Cancelar"));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("crear un rol envía el nombre y los permisos elegidos, y cierra el diálogo al tener éxito", async () => {
    createMock.mockResolvedValue({ ok: true, value: "Rol creado" });
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);
    clickElement(findButtonByText(mounted.container, "Nuevo rol"));
    const dialog = requireElement<HTMLElement>(document, '[role="dialog"]');
    clickElement(checkboxFor(dialog, "Crear y gestionar citas"));
    setFieldValue(requireElement<HTMLInputElement>(dialog, 'input[name="name"]'), "Manicurista");

    await submitFormAsync(requireElement<HTMLFormElement>(dialog, "form"));
    await flushAsync();

    expect(createMock).toHaveBeenCalledTimes(1);
    const formData = createMock.mock.calls[0]?.[1];
    expect(formData?.get("name")).toBe("Manicurista");
    expect(JSON.parse(String(formData?.get("permission_keys")))).toEqual(["appointments.manage"]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("si crear el rol falla, el diálogo permanece abierto con el error", async () => {
    createMock.mockResolvedValue({ ok: false, error: "Ya existe un rol con ese nombre" });
    mounted = mountComponent(<RolesManager roles={ROLES} allPermissions={ALL_PERMISSIONS} />);
    clickElement(findButtonByText(mounted.container, "Nuevo rol"));
    const dialog = requireElement<HTMLElement>(document, '[role="dialog"]');
    setFieldValue(requireElement<HTMLInputElement>(dialog, 'input[name="name"]'), "Estilista");

    await submitFormAsync(requireElement<HTMLFormElement>(dialog, "form"));
    await flushAsync();

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Ya existe un rol con ese nombre");
  });
});
