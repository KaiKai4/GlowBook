// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPlatformAuditLog,
  type PlatformAuditLogEntryViewModel,
  type PlatformAuditLogViewModel,
} from "@/features/platform/use-cases/get-platform-audit-log";
import { clickElement, requireElement } from "@/test/ui-shared-dom";
import PlatformAuditPage from "./page";

vi.mock("@/app/_composition/request-context", () => ({ requirePlatformAdmin: vi.fn(async () => "admin-1") }));
vi.mock("@/features/platform/use-cases/get-platform-audit-log", () => ({
  getPlatformAuditLog: vi.fn(),
}));

function entry(index: number, overrides: Partial<PlatformAuditLogEntryViewModel> = {}): PlatformAuditLogEntryViewModel {
  return {
    id: `log-${index}`,
    action: "invite_salon",
    actionLabel: "Invitar Salon",
    status: "succeeded",
    statusLabel: "Exitosa",
    actorLabel: `actor-${index}@glowbook.test`,
    targetLabel: `target-${index}`,
    metadata: [],
    errorMessage: null,
    createdAtLabel: "2 oct 2026, 10:00",
    ...overrides,
  };
}

function view(entries: PlatformAuditLogEntryViewModel[], overrides: Partial<PlatformAuditLogViewModel> = {}): PlatformAuditLogViewModel {
  return {
    entries,
    action: "all",
    status: "all",
    totalVisible: entries.length,
    failedCount: 0,
    actions: [
      { value: "all", label: "Todas las acciones" },
      { value: "invite_salon", label: "Invitar Salon" },
    ],
    statuses: [
      { value: "all", label: "Todos" },
      { value: "failed", label: "Fallidas" },
    ],
    ...overrides,
  };
}

async function element(searchParams: { action?: string; status?: string }) {
  return PlatformAuditPage({ searchParams: Promise.resolve(searchParams) });
}

describe("PlatformAuditPage tabla de eventos", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  function mount(node: Awaited<ReturnType<typeof element>>): HTMLDivElement {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(node));
    return container;
  }

  it("pagina los eventos de 10 en 10 y permite avanzar a la siguiente página", async () => {
    const entries = Array.from({ length: 12 }, (_, index) => entry(index));
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view(entries));

    const host = mount(await element({}));

    expect(host.textContent).toContain("Página 1 de 2");
    expect(host.textContent).toContain("target-0");
    expect(host.textContent).not.toContain("target-10");

    clickElement(requireElement(host, 'button[aria-label="Página siguiente"]'));

    expect(host.textContent).toContain("Página 2 de 2");
    expect(host.textContent).toContain("target-10");
    expect(host.textContent).not.toContain("target-0");
  });

  it("vuelve a la página 1 al cambiar de filtro", async () => {
    const entries = Array.from({ length: 12 }, (_, index) => entry(index));
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view(entries));
    const host = mount(await element({}));
    clickElement(requireElement(host, 'button[aria-label="Página siguiente"]'));
    expect(host.textContent).toContain("Página 2 de 2");

    vi.mocked(getPlatformAuditLog).mockResolvedValue(view(entries, { action: "invite_salon" }));
    const nextPage = await element({ action: "invite_salon" });
    act(() => root?.render(nextPage));

    expect(host.textContent).toContain("Página 1 de 2");
    expect(host.textContent).toContain("target-0");
  });

  it("muestra el estado fallido como insignia con texto y el mensaje de error", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(
      view([
        entry(0, {
          status: "failed",
          statusLabel: "Fallida",
          errorMessage: "No se pudo completar la acción.",
        }),
      ], { failedCount: 1 }),
    );

    const host = mount(await element({}));

    const badge = Array.from(host.querySelectorAll("span")).find((span) => span.textContent === "Fallida");
    expect(badge?.className).toContain("text-danger-strong");
    expect(host.textContent).toContain("No se pudo completar la acción.");
  });
});
