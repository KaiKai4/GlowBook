// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useState } from "react";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, requireElement } from "@/test/ui-shared-dom";
import { UnsavedChangesProvider, useNavigationGuard, useUnsavedChanges } from "./unsaved-changes";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

type Guard = ((href: string) => void) | null;

function DirtyForm({ dirty }: { dirty: boolean }) {
  useUnsavedChanges(dirty);
  return <p>Formulario</p>;
}

function GuardProbe({ onGuard }: { onGuard: (guard: Guard) => void }) {
  const guard = useNavigationGuard();
  onGuard(guard);
  return null;
}

// Las llamadas a la guardia actualizan estado de React: deben ejecutarse dentro de act.
function requestNavigation(probe: { guard: Guard }, href: string): void {
  act(() => {
    probe.guard?.(href);
  });
}

function dialogTitle(): string | null {
  return document.querySelector<HTMLElement>('[role="dialog"] h2')?.textContent ?? null;
}

describe("UnsavedChangesProvider", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    pushMock.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
    window.onbeforeunload = null;
  });

  it("sin provider el hook de navegación no entrega guardia", () => {
    const probe: { guard: Guard } = { guard: null };
    mounted = mountComponent(<GuardProbe onGuard={(guard) => (probe.guard = guard)} />);

    expect(probe.guard).toBeNull();
  });

  it("sin cambios pendientes navega directamente", () => {
    const probe: { guard: Guard } = { guard: null };
    mounted = mountComponent(
      <UnsavedChangesProvider>
        <GuardProbe onGuard={(value) => (probe.guard = value)} />
      </UnsavedChangesProvider>
    );

    requestNavigation(probe, "/customers");

    expect(pushMock).toHaveBeenCalledWith("/customers");
    expect(dialogTitle()).toBeNull();
  });

  it("con un formulario sucio abre la confirmación en lugar de navegar", () => {
    const probe: { guard: Guard } = { guard: null };
    mounted = mountComponent(
      <UnsavedChangesProvider>
        <DirtyForm dirty />
        <GuardProbe onGuard={(value) => (probe.guard = value)} />
      </UnsavedChangesProvider>
    );

    requestNavigation(probe, "/roles");

    expect(pushMock).not.toHaveBeenCalled();
    expect(dialogTitle()).toBe("Cambios sin guardar");
  });

  it("Seguir editando cierra la confirmación sin navegar y conserva los cambios", () => {
    const probe: { guard: Guard } = { guard: null };
    mounted = mountComponent(
      <UnsavedChangesProvider>
        <DirtyForm dirty />
        <GuardProbe onGuard={(value) => (probe.guard = value)} />
      </UnsavedChangesProvider>
    );
    requestNavigation(probe, "/roles");

    clickElement(findButtonByText(document, "Seguir editando"));

    expect(pushMock).not.toHaveBeenCalled();
    expect(dialogTitle()).toBeNull();

    requestNavigation(probe, "/roles");
    expect(dialogTitle()).toBe("Cambios sin guardar");
  });

  it("Salir sin guardar navega al destino pedido y limpia la suciedad", () => {
    const probe: { guard: Guard } = { guard: null };
    mounted = mountComponent(
      <UnsavedChangesProvider>
        <DirtyForm dirty />
        <GuardProbe onGuard={(value) => (probe.guard = value)} />
      </UnsavedChangesProvider>
    );
    requestNavigation(probe, "/roles");

    clickElement(findButtonByText(document, "Salir sin guardar"));

    expect(pushMock).toHaveBeenCalledWith("/roles");
    expect(dialogTitle()).toBeNull();

    // El formulario sigue montado y sucio: el contexto cambia al cerrar el diálogo, el
    // efecto de useUnsavedChanges vuelve a registrar la suciedad y la guardia protege de nuevo.
    // En la práctica la navegación desmonta el formulario antes de que esto importe.
    requestNavigation(probe, "/plantillas");
    expect(pushMock).not.toHaveBeenCalledWith("/plantillas");
    expect(dialogTitle()).toBe("Cambios sin guardar");
  });

  it("al desmontar el formulario sucio deja de bloquear la navegación", () => {
    const probe: { guard: Guard } = { guard: null };
    function Host() {
      const [showForm, setShowForm] = useState(true);
      return (
        <UnsavedChangesProvider>
          <button type="button" onClick={() => setShowForm(false)}>
            ocultar
          </button>
          {showForm ? <DirtyForm dirty /> : null}
          <GuardProbe onGuard={(value) => (probe.guard = value)} />
        </UnsavedChangesProvider>
      );
    }
    mounted = mountComponent(<Host />);

    clickElement(findButtonByText(document, "ocultar"));
    requestNavigation(probe, "/inicio");

    expect(pushMock).toHaveBeenCalledWith("/inicio");
    expect(dialogTitle()).toBeNull();
  });

  it("cerrar el diálogo con el botón de cierre no navega", () => {
    const probe: { guard: Guard } = { guard: null };
    mounted = mountComponent(
      <UnsavedChangesProvider>
        <DirtyForm dirty />
        <GuardProbe onGuard={(value) => (probe.guard = value)} />
      </UnsavedChangesProvider>
    );
    requestNavigation(probe, "/roles");

    clickElement(requireElement<HTMLButtonElement>(document, 'button[aria-label="Cerrar"]'));

    expect(pushMock).not.toHaveBeenCalled();
    expect(dialogTitle()).toBeNull();
  });

  it("avisa con beforeunload solo mientras hay cambios sin guardar", () => {
    mounted = mountComponent(
      <UnsavedChangesProvider>
        <DirtyForm dirty={false} />
      </UnsavedChangesProvider>
    );

    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    mounted.unmount();
    mounted = mountComponent(
      <UnsavedChangesProvider>
        <DirtyForm dirty />
      </UnsavedChangesProvider>
    );

    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });
});
