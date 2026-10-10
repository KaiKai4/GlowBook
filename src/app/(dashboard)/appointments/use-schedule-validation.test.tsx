// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  buildWizardProps,
  TEST_DATE,
  WIZARD_EMPLOYEES,
  WIZARD_SERVICES,
} from "@/test/ui-appointments-fixtures";
import type { AppointmentServiceRow, OccupiedByEmployee } from "@/features/appointments/domain/wizard-availability";
import { useScheduleValidation, type ScheduleValidation } from "./use-schedule-validation";

type Result = ScheduleValidation<(typeof WIZARD_SERVICES)[number], (typeof WIZARD_EMPLOYEES)[number]>;

const props = buildWizardProps();
const row = (serviceId: string, employeeId: string): AppointmentServiceRow => ({
  key: `${serviceId}-${employeeId}`,
  categoryId: "",
  serviceId,
  employeeId,
});

let mounted: MountedComponent | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

// Monta un componente mínimo que expone el resultado del hook en `captured`.
function mountHook(input: {
  date: string;
  time: string;
  rows: AppointmentServiceRow[];
  occupied?: OccupiedByEmployee;
}): { current: () => Result } {
  const captured: { value: Result | null } = { value: null };
  function Probe(): ReactElement {
    captured.value = useScheduleValidation({
      ...input,
      occupied: input.occupied ?? {},
      services: WIZARD_SERVICES,
      employees: WIZARD_EMPLOYEES,
      salonConfig: props.salonConfig,
      businessHours: props.businessHours,
    });
    return createElement("span");
  }
  mounted = mountComponent(createElement(Probe));
  return {
    current: () => {
      if (!captured.value) throw new Error("El hook no se ha renderizado");
      return captured.value;
    },
  };
}

describe("useScheduleValidation", () => {
  it("sin fecha no hay horario válido ni día cerrado", () => {
    const hook = mountHook({ date: "", time: "09:00", rows: [row("svc-corte", "emp-1")] });

    expect(hook.current().isClosedDay).toBe(false);
    expect(hook.current().isScheduleValid).toBe(false);
  });

  it("una fila asignada a un profesional válido en un día abierto es válida y suma el precio", () => {
    const hook = mountHook({
      date: TEST_DATE,
      time: "10:00",
      rows: [row("svc-corte", "emp-1"), row("svc-manicura", "emp-2")],
    });

    expect(hook.current().rowsAssignable).toBe(true);
    expect(hook.current().isScheduleValid).toBe(true);
    expect(hook.current().total).toBe(25 + 15);
    expect(hook.current().schedule).toHaveLength(2);
  });

  it("una fila con profesional que no hace el servicio inválida el horario", () => {
    const hook = mountHook({ date: TEST_DATE, time: "10:00", rows: [row("svc-manicura", "emp-1")] });

    expect(hook.current().rowsAssignable).toBe(false);
    expect(hook.current().isScheduleValid).toBe(false);
  });

  it("una fila sin profesional inválida el horario", () => {
    const hook = mountHook({ date: TEST_DATE, time: "10:00", rows: [row("svc-corte", "")] });

    expect(hook.current().isScheduleValid).toBe(false);
  });

  it("el profesional ocupado en el hueco deja de ser elegible", () => {
    const hook = mountHook({
      date: TEST_DATE,
      time: "10:00",
      rows: [row("svc-corte", "emp-1")],
      occupied: {
        "emp-1": [{ start_time: "2026-10-12T15:00:00Z", end_time: "2026-10-12T17:00:00Z" }],
      },
    });

    expect(hook.current().rowsAssignable).toBe(false);
  });
});
