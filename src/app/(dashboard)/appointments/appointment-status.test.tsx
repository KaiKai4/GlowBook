// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ui/status-badge";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { appointmentStatusPresentation } from "./appointment-status";

// Estados de cita que muestra la agenda. Lista local del test: el catálogo
// interno no se exporta.
const STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;

describe("appointmentStatusPresentation", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("mantiene los textos y variantes de estado que muestra la agenda", () => {
    expect(appointmentStatusPresentation("scheduled")).toEqual({ variant: "info", label: "Agendada" });
    expect(appointmentStatusPresentation("confirmed")).toEqual({ variant: "accent", label: "Confirmada" });
    expect(appointmentStatusPresentation("completed")).toEqual({ variant: "success", label: "Completada" });
    expect(appointmentStatusPresentation("cancelled")).toEqual({ variant: "neutral", label: "Cancelada" });
    expect(appointmentStatusPresentation("no_show")).toEqual({ variant: "warning", label: "No asistió" });
  });

  it("un estado desconocido cae en 'Sin estado'", () => {
    expect(appointmentStatusPresentation("archived")).toEqual({ variant: "neutral", label: "Sin estado" });
  });

  it("renderiza cada estado como texto visible, no solo como color", () => {
    for (const status of STATUSES) {
      const badge = appointmentStatusPresentation(status);
      mounted = mountComponent(<StatusBadge {...badge} />);

      expect(mounted.container.textContent).toBe(badge.label);
      mounted.unmount();
      mounted = null;
    }
  });
});
