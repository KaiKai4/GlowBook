// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ui/status-badge";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { APPOINTMENT_STATUS_BADGE } from "./appointment-status";

describe("APPOINTMENT_STATUS_BADGE", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("mantiene los textos de estado que muestra la agenda", () => {
    expect(APPOINTMENT_STATUS_BADGE).toEqual({
      scheduled: { variant: "info", label: "Agendada" },
      confirmed: { variant: "accent", label: "Confirmada" },
      completed: { variant: "success", label: "Completada" },
      cancelled: { variant: "neutral", label: "Cancelada" },
      no_show: { variant: "warning", label: "No asistió" },
    });
  });

  it("renderiza cada estado como texto visible, no solo como color", () => {
    for (const badge of Object.values(APPOINTMENT_STATUS_BADGE)) {
      mounted = mountComponent(<StatusBadge {...badge} />);

      expect(mounted.container.textContent).toBe(badge.label);
      mounted.unmount();
      mounted = null;
    }
  });
});
