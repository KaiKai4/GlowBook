// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, flushAsync, pressKey, requireElement } from "@/test/ui-shared-dom";
import { deleteRoleAction } from "./actions";
import { RoleDeleteButton } from "./delete-role-dialog";

vi.mock("./actions", () => ({
  deleteRoleAction: vi.fn(),
}));

const deleteMock = vi.mocked(deleteRoleAction);

function openDialog(container: HTMLElement): void {
  clickElement(requireElement<HTMLButtonElement>(container, 'button[aria-label="Eliminar rol"]'));
}

function dialogOf(container: HTMLElement): Element | null {
  return container.querySelector('[role="dialog"]');
}

describe("RoleDeleteButton (diálogo de confirmación)", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    deleteMock.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("Cancelar cierra el diálogo sin llamar a la acción de borrado", () => {
    mounted = mountComponent(<RoleDeleteButton roleId="role-1" roleName="Estilista" />);

    openDialog(mounted.container);
    expect(dialogOf(mounted.container)?.textContent).toContain("Estilista");

    clickElement(findButtonByText(mounted.container, "Cancelar"));

    expect(dialogOf(mounted.container)).toBeNull();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("la tecla Escape cierra el diálogo cuando no hay borrado en curso", () => {
    mounted = mountComponent(<RoleDeleteButton roleId="role-1" roleName="Estilista" />);

    openDialog(mounted.container);
    pressKey(document.body, "Escape");

    expect(dialogOf(mounted.container)).toBeNull();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("mientras el borrado está en curso, Escape no cierra el diálogo", async () => {
    // El borrado queda pendiente hasta que el test lo resuelve al final (sin transiciones colgadas).
    const resolvers: Array<(result: Awaited<ReturnType<typeof deleteRoleAction>>) => void> = [];
    deleteMock.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));
    mounted = mountComponent(<RoleDeleteButton roleId="role-1" roleName="Estilista" />);

    openDialog(mounted.container);
    clickElement(findButtonByText(mounted.container, "Eliminar"));
    expect(deleteMock).toHaveBeenCalledWith("role-1");

    pressKey(document.body, "Escape");
    expect(dialogOf(mounted.container)).not.toBeNull();

    resolvers.forEach((resolve) => resolve({ ok: true, value: undefined }));
    await flushAsync();
  });

  it("al cerrar y volver a abrir, el error anterior ya no se muestra", async () => {
    deleteMock.mockResolvedValue({ ok: false, error: "El rol tiene colaboradores activos" });
    mounted = mountComponent(<RoleDeleteButton roleId="role-1" roleName="Estilista" />);

    openDialog(mounted.container);
    clickElement(findButtonByText(mounted.container, "Eliminar"));
    await flushAsync();
    expect(mounted.container.textContent).toContain("El rol tiene colaboradores activos");
    await flushAsync();

    clickElement(findButtonByText(mounted.container, "Cancelar"));
    openDialog(mounted.container);

    expect(mounted.container.textContent).not.toContain("El rol tiene colaboradores activos");
  });
});
