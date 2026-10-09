// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import {
  buttonWithText,
  chooseSelectOptionByCurrentText,
  click,
  flushAsync,
  formOf,
  submitForm,
} from "@/test/ui-people-dom";
import { addWorkScheduleAction, deleteWorkScheduleAction } from "../actions";
import { WorkScheduleEditor } from "./work-schedule-editor";

vi.mock("../actions", () => ({
  addWorkScheduleAction: vi.fn(),
  deleteWorkScheduleAction: vi.fn(),
}));

const SCHEDULES = [
  { id: "s-tue", day_of_week: 1, start_time: "09:00:00", end_time: "13:00:00" },
  { id: "s-mon-late", day_of_week: 0, start_time: "14:00:00", end_time: "18:00:00" },
  { id: "s-mon-early", day_of_week: 0, start_time: "09:00:00", end_time: "12:00:00" },
];

function renderEditor(schedules = SCHEDULES): MountedComponent {
  return mountComponent(<WorkScheduleEditor employeeId="emp-1" schedules={schedules} />);
}

function scheduleItems(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("li")).map((item) => item.textContent?.replace(/\s+/g, " ").trim() ?? "");
}

describe("WorkScheduleEditor", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(addWorkScheduleAction).mockReset();
    vi.mocked(deleteWorkScheduleAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra los bloques ordenados por día y hora con horas recortadas a HH:MM", () => {
    mounted = renderEditor();

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Horario laboral");
    expect(scheduleItems(mounted.container)).toEqual([
      "Lunes 09:00 – 12:00",
      "Lunes 14:00 – 18:00",
      "Martes 09:00 – 13:00",
    ]);
  });

  it("explica que sin bloques se usa el horario del salón", () => {
    mounted = renderEditor([]);

    expect(mounted.container.textContent).toContain(
      "Sin horario configurado. (Si no hay horario, se usa el del salón.)"
    );
    expect(mounted.container.querySelector("li")).toBeNull();
  });

  it("muestra u oculta el formulario de nuevo bloque al pulsar Agregar bloque", () => {
    mounted = renderEditor();

    expect(mounted.container.querySelector("form")).toBeNull();
    click(buttonWithText(mounted.container, "Agregar bloque"));
    expect(mounted.container.querySelector("form")).not.toBeNull();
    click(buttonWithText(mounted.container, "Agregar bloque"));
    expect(mounted.container.querySelector("form")).toBeNull();
  });

  it("crea un bloque con el día elegido y las horas por defecto", async () => {
    vi.mocked(addWorkScheduleAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderEditor([]);

    click(buttonWithText(mounted.container, "Agregar bloque"));
    chooseSelectOptionByCurrentText(mounted.container, "Lunes", "Miércoles");
    await submitForm(formOf(mounted.container));
    await flushAsync();

    expect(addWorkScheduleAction).toHaveBeenCalledTimes(1);
    const [previous, formData] = vi.mocked(addWorkScheduleAction).mock.calls[0] ?? [];
    expect(previous).toBeNull();
    expect(formData?.get("employee_id")).toBe("emp-1");
    expect(formData?.get("day_of_week")).toBe("2");
    expect(formData?.get("start_time")).toBe("09:00");
    expect(formData?.get("end_time")).toBe("17:00");
    expect(mounted.container.querySelector("form")).toBeNull();
  });

  it("muestra el error del servidor y mantiene el formulario abierto", async () => {
    vi.mocked(addWorkScheduleAction).mockResolvedValue({ ok: false, error: "El bloque se solapa con otro horario" });
    mounted = renderEditor([]);

    click(buttonWithText(mounted.container, "Agregar bloque"));
    await submitForm(formOf(mounted.container));
    await flushAsync();

    expect(mounted.container.textContent).toContain("El bloque se solapa con otro horario");
    expect(mounted.container.querySelector("form")).not.toBeNull();
  });

  it("elimina un bloque concreto con su identificador y el id del colaborador", () => {
    vi.mocked(deleteWorkScheduleAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderEditor();

    const deleteButtons = mounted.container.querySelectorAll<HTMLButtonElement>('button[aria-label="Eliminar"]');
    const second = deleteButtons[1];
    if (!second) throw new Error("falta el segundo botón de eliminar");
    click(second);

    expect(deleteWorkScheduleAction).toHaveBeenCalledWith("s-mon-late", "emp-1");
  });

  it("si el borrado falla se muestra el error al usuario", async () => {
    vi.mocked(deleteWorkScheduleAction).mockResolvedValue({ ok: false, error: "No se pudo eliminar el bloque" });
    mounted = renderEditor();

    const first = mounted.container.querySelector<HTMLButtonElement>('button[aria-label="Eliminar"]');
    if (!first) throw new Error("falta el botón de eliminar");
    click(first);
    await flushAsync();

    expect(deleteWorkScheduleAction).toHaveBeenCalledTimes(1);
    expect(mounted.container.textContent).toContain("No se pudo eliminar el bloque");
  });
});
