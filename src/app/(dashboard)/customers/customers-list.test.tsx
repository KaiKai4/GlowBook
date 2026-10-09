// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click, flushAsync } from "@/test/ui-people-dom";
import { buildCustomerRow } from "@/test/ui-people-fixtures";
import { reactivateCustomerAction } from "./actions";
import { CustomersList } from "./customers-list";

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

const ANA = buildCustomerRow({ id: "cust-1", first_name: "Ana", last_name: "Vega", phone: "60001234", email: "ana@example.com" });

describe("CustomersList", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.refresh.mockReset();
    vi.mocked(reactivateCustomerAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("no renderiza nada cuando la lista está vacía", () => {
    mounted = mountComponent(<CustomersList customers={[]} mode="active" />);

    expect(mounted.container.innerHTML).toBe("");
  });

  it("muestra nombre completo, teléfono y correo de cada cliente", () => {
    mounted = mountComponent(<CustomersList customers={[ANA]} mode="active" />);

    expect(mounted.container.textContent).toContain("Ana Vega");
    expect(mounted.container.textContent).toContain("60001234");
    expect(mounted.container.textContent).toContain("ana@example.com");
    expect(mounted.container.textContent).not.toContain("Temporal");
  });

  it("omite teléfono y correo cuando el cliente no los tiene", () => {
    mounted = mountComponent(
      <CustomersList customers={[buildCustomerRow({ phone: null, email: null })]} mode="active" />
    );

    expect(mounted.container.querySelectorAll("span.text-xs")).toHaveLength(0);
  });

  it("marca como Temporal a los clientes temporales", () => {
    mounted = mountComponent(
      <CustomersList customers={[buildCustomerRow({ is_temporary: true })]} mode="active" />
    );

    expect(mounted.container.textContent).toContain("Temporal");
  });

  it("en modo activo abre el modal de edición con los datos del cliente", () => {
    mounted = mountComponent(<CustomersList customers={[ANA]} mode="active" />);

    click(buttonWithText(mounted.container, "Editar"));

    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Editar cliente");
    const values = Array.from(document.body.querySelectorAll<HTMLInputElement>("input")).map((input) => input.value);
    expect(values).toContain("Ana");
    expect(values).toContain("Vega");
  });

  it("en modo archivado reactiva el cliente y refresca la vista al tener éxito", async () => {
    vi.mocked(reactivateCustomerAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<CustomersList customers={[ANA]} mode="archived" />);

    expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
    click(buttonWithText(mounted.container, "Reactivar"));
    await flushAsync();

    expect(reactivateCustomerAction).toHaveBeenCalledWith("cust-1");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("muestra el error cuando la reactivación falla y no refresca", async () => {
    vi.mocked(reactivateCustomerAction).mockResolvedValue({
      ok: false,
      error: "Ya existe un cliente activo con ese teléfono",
    });
    mounted = mountComponent(<CustomersList customers={[ANA]} mode="archived" />);

    click(buttonWithText(mounted.container, "Reactivar"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("Ya existe un cliente activo con ese teléfono");
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("muestra el estado de carga del botón Reactivar mientras la acción está en curso", async () => {
    let resolveAction: (value: { ok: true; value: undefined }) => void = () => undefined;
    vi.mocked(reactivateCustomerAction).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      })
    );
    mounted = mountComponent(<CustomersList customers={[ANA]} mode="archived" />);

    click(buttonWithText(mounted.container, "Reactivar"));
    await flushAsync();

    const pendingButton = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.querySelector("svg.animate-spin")
    );
    expect(pendingButton?.disabled).toBe(true);

    resolveAction({ ok: true, value: undefined });
    await flushAsync();
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });
});
