// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, flushAsync, requireElement, setFieldValue, submitFormAsync } from "@/test/ui-shared-dom";
import { createExpenseAction } from "./actions";
import { ExpenseGeneralForm } from "./expense-general-form";

vi.mock("./actions", () => ({
  createExpenseAction: vi.fn(),
}));

const createExpenseMock = vi.mocked(createExpenseAction);

function form(container: HTMLElement): HTMLFormElement {
  return requireElement<HTMLFormElement>(container, "form");
}

function fieldNamed(container: HTMLElement, name: string): HTMLInputElement | HTMLTextAreaElement {
  return requireElement<HTMLInputElement | HTMLTextAreaElement>(container, `[name="${name}"]`);
}

function conceptLabel(container: HTMLElement): string | null {
  return container.querySelector(`input[name="concept"]`)?.closest("div.flex")?.querySelector("label")?.textContent ?? null;
}

describe("ExpenseGeneralForm", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    createExpenseMock.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("arranca con la categoría Alquiler y un detalle opcional", () => {
    mounted = mountComponent(<ExpenseGeneralForm onResult={vi.fn()} />);

    expect(mounted.container.textContent).toContain("Alquiler");
    expect(conceptLabel(mounted.container)).toBe("Detalle (opcional)");
    expect(fieldNamed(mounted.container, "concept").required).toBe(false);
  });

  it("al elegir 'Otro' pide describir el gasto de forma obligatoria", () => {
    mounted = mountComponent(<ExpenseGeneralForm onResult={vi.fn()} />);

    clickElement(requireElement<HTMLButtonElement>(mounted.container, "button[aria-haspopup='listbox']"));
    const other = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(
      (option) => option.textContent === "Otro"
    );
    if (!other) throw new Error("Falta la opción Otro");
    clickElement(other);

    expect(conceptLabel(mounted.container)).toBe("Describe el gasto");
    expect(fieldNamed(mounted.container, "concept").required).toBe(true);
  });

  it("publica la fecha de hoy en formato ISO y el monto como obligatorio", () => {
    mounted = mountComponent(<ExpenseGeneralForm onResult={vi.fn()} />);

    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(mounted.container.querySelector<HTMLInputElement>('input[name="expense_date"]')?.value).toBe(expected);
    expect(fieldNamed(mounted.container, "amount").required).toBe(true);
  });

  it("envía los datos del formulario a la acción y reporta el éxito al padre", async () => {
    createExpenseMock.mockResolvedValue({ ok: true, value: "Gasto registrado." });
    const onResult = vi.fn();
    mounted = mountComponent(<ExpenseGeneralForm onResult={onResult} />);

    setFieldValue(fieldNamed(mounted.container, "amount") as HTMLInputElement, "45.5");
    setFieldValue(fieldNamed(mounted.container, "vendor_name") as HTMLInputElement, "Naturgy");
    setFieldValue(fieldNamed(mounted.container, "note"), "Recibo de marzo");
    await submitFormAsync(form(mounted.container));
    await flushAsync();

    expect(createExpenseMock).toHaveBeenCalledTimes(1);
    const [, formData] = createExpenseMock.mock.calls[0] ?? [];
    expect(formData?.get("amount")).toBe("45.5");
    expect(formData?.get("category")).toBe("rent");
    expect(formData?.get("vendor_name")).toBe("Naturgy");
    expect(formData?.get("note")).toBe("Recibo de marzo");
    expect(onResult).toHaveBeenCalledWith({ ok: true, message: "Gasto registrado." });
  });

  it("si la acción falla, reporta el error al padre con su mensaje", async () => {
    createExpenseMock.mockResolvedValue({ ok: false, error: "El monto debe ser mayor que cero" });
    const onResult = vi.fn();
    mounted = mountComponent(<ExpenseGeneralForm onResult={onResult} />);

    await submitFormAsync(form(mounted.container));
    await flushAsync();

    expect(onResult).toHaveBeenCalledWith({ ok: false, message: "El monto debe ser mayor que cero" });
  });
});
