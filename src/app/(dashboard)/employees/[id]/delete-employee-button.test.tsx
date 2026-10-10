// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click, flushAsync } from "@/test/ui-people-dom";
import { deleteEmployeeAction } from "../actions-profile";
import { DeleteEmployeeButton } from "./delete-employee-button";

const routerMock = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("../actions-profile", () => ({
  deleteEmployeeAction: vi.fn(),
}));

function dialogText(): string {
  return document.body.querySelector('[role="dialog"]')?.textContent ?? "";
}

describe("DeleteEmployeeButton", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.push.mockReset();
    routerMock.refresh.mockReset();
    vi.mocked(deleteEmployeeAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("no pide confirmación hasta pulsar el botón de eliminar", () => {
    mounted = mountComponent(<DeleteEmployeeButton employeeId="emp-1" employeeName="Ana Vega" />);

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    click(buttonWithText(mounted.container, "Eliminar colaborador"));

    expect(dialogText()).toContain("Esta acción intentará eliminar a Ana Vega. Si tiene historial, se archivará.");
  });

  it("cancelar la confirmación no ejecuta la eliminación", () => {
    mounted = mountComponent(<DeleteEmployeeButton employeeId="emp-1" employeeName="Ana Vega" />);

    click(buttonWithText(mounted.container, "Eliminar colaborador"));
    click(buttonWithText(document.body, "Cancelar"));

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(deleteEmployeeAction).not.toHaveBeenCalled();
  });

  it("al confirmar un borrado completo navega a la lista y refresca", async () => {
    vi.mocked(deleteEmployeeAction).mockResolvedValue({
      ok: true,
      value: { outcome: "deleted", message: "Colaborador eliminado." },
    });
    mounted = mountComponent(<DeleteEmployeeButton employeeId="emp-1" employeeName="Ana Vega" />);

    click(buttonWithText(mounted.container, "Eliminar colaborador"));
    click(buttonWithText(document.body, "Eliminar"));
    await flushAsync();

    expect(deleteEmployeeAction).toHaveBeenCalledWith("emp-1");
    expect(routerMock.push).toHaveBeenCalledWith("/employees");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("si el colaborador se archiva en lugar de borrarse muestra el mensaje antes de salir", async () => {
    vi.mocked(deleteEmployeeAction).mockResolvedValue({
      ok: true,
      value: { outcome: "archived", message: "Tiene citas asociadas, por lo que se archivó." },
    });
    mounted = mountComponent(<DeleteEmployeeButton employeeId="emp-1" employeeName="Ana Vega" />);

    click(buttonWithText(mounted.container, "Eliminar colaborador"));
    click(buttonWithText(document.body, "Eliminar"));
    await flushAsync();

    expect(dialogText()).toContain("Colaborador archivado");
    expect(dialogText()).toContain("Tiene citas asociadas, por lo que se archivó.");
    expect(routerMock.push).not.toHaveBeenCalled();

    click(buttonWithText(document.body, "Entendido"));

    expect(routerMock.push).toHaveBeenCalledWith("/employees");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("muestra el error dentro de la confirmación cuando el borrado falla", async () => {
    vi.mocked(deleteEmployeeAction).mockResolvedValue({ ok: false, error: "No tienes permiso para eliminar colaboradores" });
    mounted = mountComponent(<DeleteEmployeeButton employeeId="emp-1" employeeName="Ana Vega" />);

    click(buttonWithText(mounted.container, "Eliminar colaborador"));
    click(buttonWithText(document.body, "Eliminar"));
    await flushAsync();

    expect(dialogText()).toContain("No tienes permiso para eliminar colaboradores");
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
