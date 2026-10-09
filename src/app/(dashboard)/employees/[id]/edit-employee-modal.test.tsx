// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => toast,
}));
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithAriaLabel, buttonWithText, click, fieldByLabel, setFieldValue } from "@/test/ui-people-dom";
import { updateEmployeeAction } from "../actions";
import type { CategoryOption } from "../types";
import { EditEmployeeModal } from "./edit-employee-modal";
import { act } from "react";
import { SAVED_WITH_WARNINGS_MESSAGE } from "@/components/forms/use-submission-intent";
import { UUID_PATTERN, idempotencyKeyOf, settleSubmission } from "@/test/form-intent-dom";

describe("EditEmployeeModal envío con intención idempotente", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(updateEmployeeAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("envía idempotency_key y la mantiene al reintentar tras un error", async () => {
    vi.mocked(updateEmployeeAction)
      .mockResolvedValueOnce({ ok: false, error: "El email ya está en uso" })
      .mockResolvedValueOnce({ ok: true, value: undefined });
    mounted = renderModal();
    openModal(mounted.container);

    click(buttonWithText(document.body, "Guardar cambios"));
    await settleSubmission();
    click(buttonWithText(document.body, "Guardar cambios"));
    await settleSubmission();

    const calls = vi.mocked(updateEmployeeAction).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0]).toBe("emp-1");
    const firstKey = idempotencyKeyOf(calls[0]?.[2]);
    expect(firstKey).toMatch(UUID_PATTERN);
    expect(idempotencyKeyOf(calls[1]?.[2])).toBe(firstKey);
  });

  it("no se puede cerrar con Escape, la X ni Cancelar mientras el guardado está en curso", async () => {
    let release: (value: Awaited<ReturnType<typeof updateEmployeeAction>>) => void = () => {};
    vi.mocked(updateEmployeeAction).mockReturnValue(
      new Promise((done) => {
        release = done;
      })
    );
    mounted = renderModal();
    openModal(mounted.container);

    click(buttonWithText(document.body, "Guardar cambios"));
    await settleSubmission();
    expect(updateEmployeeAction).toHaveBeenCalledTimes(1);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    const closeButton = document.body.querySelector<HTMLButtonElement>("button[aria-label='Cerrar']");
    expect(closeButton?.disabled).toBe(true);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      release({ ok: true, value: undefined });
    });
    await settleSubmission();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("avisa cuando los datos se guardaron pero un efecto posterior falló", async () => {
    vi.mocked(updateEmployeeAction).mockResolvedValueOnce({
      ok: true,
      value: undefined,
      warnings: ["Los servicios no se actualizaron."],
    } as Awaited<ReturnType<typeof updateEmployeeAction>>);
    mounted = renderModal();
    openModal(mounted.container);

    click(buttonWithText(document.body, "Guardar cambios"));
    await settleSubmission();

    expect(toast.warning).toHaveBeenCalledWith(SAVED_WITH_WARNINGS_MESSAGE);
  });
});

const routerMock = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("../actions", () => ({
  updateEmployeeAction: vi.fn(),
}));

const CATEGORIES: CategoryOption[] = [
  { id: "cat-cabello", name: "Cabello", services: [{ id: "svc-corte", name: "Corte" }] },
  { id: "cat-unas", name: "Uñas", services: [{ id: "svc-manicura", name: "Manicura" }] },
];

const EMPLOYEE = {
  id: "emp-1",
  first_name: "Ana",
  last_name: "Vega",
  phone: "60001234",
  email: "ana@example.com",
  specialty: "Coloración",
  commission_percentage: 30,
};

function renderModal(): MountedComponent {
  return mountComponent(
    <EditEmployeeModal
      employee={EMPLOYEE}
      categories={CATEGORIES}
      selectedCategoryIds={["cat-cabello"]}
      selectedServiceIds={["svc-corte"]}
    />
  );
}

function openModal(container: HTMLElement): void {
  click(buttonWithText(container, "Editar datos"));
}

describe("EditEmployeeModal", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.refresh.mockReset();
    vi.mocked(updateEmployeeAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("abre el diálogo con los datos actuales del colaborador", () => {
    mounted = renderModal();
    openModal(mounted.container);

    expect(fieldByLabel(document.body, "Nombre").value).toBe("Ana");
    expect(fieldByLabel(document.body, "Teléfono").value).toBe("60001234");
    expect(fieldByLabel(document.body, "Especialidad").value).toBe("Coloración");
    expect(fieldByLabel(document.body, "Comisión (%)").value).toBe("30");
    expect(document.body.textContent).toContain("Corte");
  });

  it("rechaza guardar sin nombre o apellido y no llama a la acción", () => {
    mounted = renderModal();
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Apellido"), "  ");
    click(buttonWithText(document.body, "Guardar cambios"));

    expect(document.body.textContent).toContain("Nombre y apellido son obligatorios.");
    expect(updateEmployeeAction).not.toHaveBeenCalled();
  });

  it("guarda los datos recortados con categorías y servicios elegidos y refresca la vista", async () => {
    vi.mocked(updateEmployeeAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderModal();
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Nombre"), " Ana María ");
    setFieldValue(fieldByLabel(document.body, "Especialidad"), "  Balayage ");
    setFieldValue(fieldByLabel(document.body, "Comisión (%)"), "");
    click(buttonWithText(document.body, "Uñas"));
    click(buttonWithText(document.body, "Guardar cambios"));
    await settleSubmission();

    expect(updateEmployeeAction).toHaveBeenCalledTimes(1);
    const [employeeId, previous, formData] = vi.mocked(updateEmployeeAction).mock.calls[0] ?? [];
    expect(employeeId).toBe("emp-1");
    expect(previous).toBeNull();
    expect(formData?.get("first_name")).toBe("Ana María");
    expect(formData?.get("specialty")).toBe("Balayage");
    expect(formData?.get("commission_percentage")).toBe("0");
    expect(formData?.getAll("category_ids")).toEqual(["cat-cabello", "cat-unas"]);
    expect(formData?.getAll("service_ids")).toEqual(["svc-corte"]);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("muestra el error de la acción y mantiene el diálogo abierto", async () => {
    vi.mocked(updateEmployeeAction).mockResolvedValue({ ok: false, error: "El teléfono ya está registrado" });
    mounted = renderModal();
    openModal(mounted.container);

    click(buttonWithText(document.body, "Guardar cambios"));
    await settleSubmission();

    expect(document.body.textContent).toContain("El teléfono ya está registrado");
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("al cancelar descarta los cambios y reabre con los datos originales", () => {
    mounted = renderModal();
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Nombre"), "Cambiado");
    click(buttonWithText(document.body, "Cancelar"));
    openModal(mounted.container);

    expect(fieldByLabel(document.body, "Nombre").value).toBe("Ana");
    expect(updateEmployeeAction).not.toHaveBeenCalled();
  });

  it("envía el teléfono y el correo editados", async () => {
    vi.mocked(updateEmployeeAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderModal();
    openModal(mounted.container);

    setFieldValue(fieldByLabel(document.body, "Teléfono"), " 61112222 ");
    setFieldValue(fieldByLabel(document.body, "Email"), " ana.vega@example.com ");
    click(buttonWithText(document.body, "Guardar cambios"));
    await settleSubmission();

    const formData = vi.mocked(updateEmployeeAction).mock.calls[0]?.[2];
    expect(formData?.get("phone")).toBe("61112222");
    expect(formData?.get("email")).toBe("ana.vega@example.com");
  });

  it("no cierra el diálogo con la X mientras el guardado está en curso", () => {
    vi.mocked(updateEmployeeAction).mockReturnValue(new Promise<never>(() => undefined));
    mounted = renderModal();
    openModal(mounted.container);

    click(buttonWithText(document.body, "Guardar cambios"));
    click(buttonWithAriaLabel(document.body, "Cerrar"));

    expect(fieldByLabel(document.body, "Nombre").value).toBe("Ana");
  });

  it("tolera colaboradores sin teléfono, especialidad ni comisión registradas", () => {
    // La base de datos puede guardar estos campos como null aunque el tipo los declare como texto o número.
    const incomplete = Object.assign({}, EMPLOYEE, {
      phone: null,
      specialty: null,
      commission_percentage: null,
    });
    mounted = mountComponent(
      <EditEmployeeModal employee={incomplete} categories={CATEGORIES} selectedCategoryIds={[]} selectedServiceIds={[]} />
    );
    openModal(mounted.container);
    expect(fieldByLabel(document.body, "Teléfono").value).toBe("");
    expect(fieldByLabel(document.body, "Especialidad").value).toBe("");
    expect(fieldByLabel(document.body, "Comisión (%)").value).toBe("0");

    click(buttonWithText(document.body, "Cancelar"));
    openModal(mounted.container);
    expect(fieldByLabel(document.body, "Teléfono").value).toBe("");
  });
});
