// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExpensesPageView } from "@/features/expenses/use-cases/expenses";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, flushAsync, requireElement, setFieldValue, submitFormAsync } from "@/test/ui-shared-dom";
import { createExpenseAction } from "./actions";
import { ExpensesManager } from "./expenses-manager";

vi.mock("./actions", () => ({
  createExpenseAction: vi.fn(),
  createInventoryPurchaseExpenseAction: vi.fn(),
}));

const createExpenseMock = vi.mocked(createExpenseAction);

const EMPTY_VIEW: ExpensesPageView = {
  history: [],
  monthTotal: 0,
  lifetimeTotal: 0,
  categoryTotals: [],
  topCategory: null,
};

// El aviso de resultado se identifica por los colores de éxito o de error del componente.
function feedbackBox(container: HTMLElement): string | null {
  const box = Array.from(container.querySelectorAll<HTMLElement>("div")).find(
    (element) =>
      element.className.includes("border-success-border") || element.className.includes("border-danger-border")
  );
  return box?.textContent ?? null;
}

describe("ExpensesManager", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    createExpenseMock.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("abre en el historial con las estadísticas y las pestañas", () => {
    mounted = mountComponent(
      <ExpensesManager expenses={EMPTY_VIEW} inventoryProducts={[]} canManageInventory={false} />
    );

    expect(mounted.container.textContent).toContain("Historial de egresos");
    expect(mounted.container.textContent).toContain("Egresos este mes");
    expect(mounted.container.querySelector("form")).toBeNull();
  });

  it("cambiar de pestaña muestra su formulario y limpia el mensaje previo", async () => {
    createExpenseMock.mockResolvedValue({ ok: false, error: "Monto inválido" });
    mounted = mountComponent(
      <ExpensesManager expenses={EMPTY_VIEW} inventoryProducts={[]} canManageInventory={false} />
    );
    clickElement(findButtonByText(mounted.container, "Nuevo gasto"));
    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();
    expect(feedbackBox(mounted.container)).toContain("Monto inválido");

    clickElement(findButtonByText(mounted.container, "Historial"));

    expect(feedbackBox(mounted.container)).toBeNull();
    expect(mounted.container.querySelector("form")).toBeNull();
  });

  it("un error de la acción se muestra en la barra de avisos y permanece en la pestaña actual", async () => {
    createExpenseMock.mockResolvedValue({ ok: false, error: "Falta el concepto" });
    mounted = mountComponent(
      <ExpensesManager expenses={EMPTY_VIEW} inventoryProducts={[]} canManageInventory={false} />
    );
    clickElement(findButtonByText(mounted.container, "Nuevo gasto"));

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();

    expect(feedbackBox(mounted.container)).toContain("Falta el concepto");
    expect(mounted.container.querySelector("form")).not.toBeNull();
  });

  it("un gasto registrado vuelve al historial y muestra el mensaje de éxito", async () => {
    createExpenseMock.mockResolvedValue({ ok: true, value: "Gasto registrado." });
    mounted = mountComponent(
      <ExpensesManager expenses={EMPTY_VIEW} inventoryProducts={[]} canManageInventory={false} />
    );
    clickElement(findButtonByText(mounted.container, "Nuevo gasto"));
    setFieldValue(requireElement<HTMLInputElement>(mounted.container, 'input[name="amount"]'), "20");

    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();

    expect(feedbackBox(mounted.container)).toContain("Gasto registrado.");
    expect(mounted.container.querySelector("form")).toBeNull();
    expect(mounted.container.textContent).toContain("Historial de egresos");
  });

  it("el aviso desaparece automáticamente a los 4 segundos", async () => {
    createExpenseMock.mockResolvedValue({ ok: true, value: "Gasto registrado." });
    mounted = mountComponent(
      <ExpensesManager expenses={EMPTY_VIEW} inventoryProducts={[]} canManageInventory={false} />
    );
    clickElement(findButtonByText(mounted.container, "Nuevo gasto"));
    await submitFormAsync(requireElement<HTMLFormElement>(mounted.container, "form"));
    await flushAsync();
    expect(feedbackBox(mounted.container)).toContain("Gasto registrado.");

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(feedbackBox(mounted.container)).toBeNull();
  });
});
