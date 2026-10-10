// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { Alert } from "./alert";

describe("Alert", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el título en negrita semibold y el contenido debajo", () => {
    mounted = mountComponent(
      <Alert variant="warning" title="¿Guardar?">
        <span>Detalle</span>
      </Alert>
    );

    const root = mounted.container.firstElementChild as HTMLElement;
    const title = root.querySelector("p");
    expect(title?.textContent).toBe("¿Guardar?");
    expect(title?.className).toContain("font-semibold");
    expect(root.textContent).toContain("Detalle");
  });

  it.each([
    ["info", "bg-info-subtle", "border-info-border", "text-info-strong"],
    ["success", "bg-success-subtle", "border-success-border", "text-success-strong"],
    ["warning", "bg-warning-subtle", "border-warning-border", "text-warning-strong"],
    ["danger", "bg-danger-subtle", "border-danger-border", "text-danger-strong"],
  ] as const)(
    "la variante %s usa tokens de fondo, borde y texto",
    (variant, background, border, text) => {
      mounted = mountComponent(<Alert variant={variant}>Aviso</Alert>);

      const root = mounted.container.firstElementChild as HTMLElement;
      expect(root.className).toContain(background);
      expect(root.className).toContain(border);
      expect(root.className).toContain(text);
    }
  );

  it("solo añade role cuando se pide, para anunciar el aviso", () => {
    mounted = mountComponent(<Alert variant="danger" role="alert">Fallo</Alert>);
    expect(mounted.container.querySelector("[role='alert']")?.textContent).toBe("Fallo");
  });

  it("no añade role por defecto", () => {
    mounted = mountComponent(<Alert variant="info">Nota</Alert>);
    expect(mounted.container.firstElementChild?.getAttribute("role")).toBeNull();
  });

  it("no usa colores de paleta cruda", () => {
    mounted = mountComponent(<Alert variant="danger">Fallo</Alert>);
    expect(mounted.container.innerHTML).not.toMatch(/bg-(red|amber|sky|emerald)-\d/);
  });
});
