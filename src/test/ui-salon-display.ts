// Montaje de componentes de la agenda dentro de SalonDisplayProvider, como hace
// AppointmentsClient en producción. Evita repetir tz y nombre del salón en cada test.
import { createElement, type ComponentProps, type ReactElement } from "react";
import { SalonDisplayProvider, type SalonDisplay } from "@/app/(dashboard)/appointments/salon-display-context";
import { mountComponent, type MountedComponent } from "./render-dom";
import { SALON_TZ } from "./ui-appointments-fixtures";

export const SALON_DISPLAY: SalonDisplay = { tz: SALON_TZ, salonName: "Salón Prueba" };

/** Monta el elemento con tz y nombre del salón provistos por el contexto de la agenda. */
export function mountWithSalon(
  element: ReactElement,
  display: SalonDisplay = SALON_DISPLAY
): MountedComponent {
  const props: ComponentProps<typeof SalonDisplayProvider> = { value: display, children: element };
  return mountComponent(createElement(SalonDisplayProvider, props));
}
