// Montaje mínimo de componentes React para tests en jsdom.
// Usa react-dom/client y act() de React directamente: no añade dependencias.
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

export interface MountedComponent {
  container: HTMLDivElement;
  unmount: () => void;
}

/** Monta el elemento en un contenedor del DOM de jsdom y espera a que React lo pinte. */
export function mountComponent(element: ReactElement): MountedComponent {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}
