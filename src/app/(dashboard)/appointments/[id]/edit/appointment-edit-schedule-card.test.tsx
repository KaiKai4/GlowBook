// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { AppointmentEditScheduleCard } from "./appointment-edit-schedule-card";

vi.mock("@/components/ui/date-picker", () => import("@/test/ui-appointments-pickers"));
vi.mock("@/components/ui/time-picker", () => import("@/test/ui-appointments-pickers"));

const OPEN_WINDOW = { open: "08:00", close: "18:00" };

describe("AppointmentEditScheduleCard", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el horario del salón para el día elegido", () => {
    mounted = mountComponent(
      <AppointmentEditScheduleCard
        date="2026-10-12"
        time="14:00"
        selectedWindow={OPEN_WINDOW}
        isClosedDay={false}
        onDateChange={vi.fn()}
        onTimeChange={vi.fn()}
      />
    );

    expect(mounted.container.textContent).toContain("Horario del salón: 08:00 - 18:00.");
    expect(mounted.container.textContent).not.toContain("El salón está cerrado ese día.");
  });

  it("avisa cuando el salón está cerrado ese día y no muestra horario", () => {
    mounted = mountComponent(
      <AppointmentEditScheduleCard
        date="2026-10-12"
        time="14:00"
        selectedWindow={null}
        isClosedDay
        onDateChange={vi.fn()}
        onTimeChange={vi.fn()}
      />
    );

    expect(mounted.container.textContent).toContain("El salón está cerrado ese día.");
    expect(mounted.container.textContent).not.toContain("Horario del salón");
  });
});
