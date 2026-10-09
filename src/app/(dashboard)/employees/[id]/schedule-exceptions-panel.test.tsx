// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithAriaLabel, buttonWithText, click, fieldByLabel, flushAsync, setFieldValue } from "@/test/ui-people-dom";
import { addScheduleExceptionAction, removeScheduleExceptionAction } from "../actions";
import { ScheduleExceptionsPanel } from "./schedule-exceptions-panel";

const routerMock = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => toastMock,
}));

vi.mock("../actions", () => ({
  addScheduleExceptionAction: vi.fn(),
  removeScheduleExceptionAction: vi.fn(),
}));

const EXCEPTIONS = [
  { id: "ex-1", date: "2026-10-12", reason: "Vacaciones" },
  { id: "ex-2", date: "2026-11-02", reason: "" },
];

function renderPanel(exceptions = EXCEPTIONS): MountedComponent {
  return mountComponent(<ScheduleExceptionsPanel employeeId="emp-1" exceptions={exceptions} />);
}

describe("ScheduleExceptionsPanel", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.refresh.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    vi.mocked(addScheduleExceptionAction).mockReset();
    vi.mocked(removeScheduleExceptionAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("indica que no hay días libres próximos cuando la lista está vacía", () => {
    mounted = renderPanel([]);

    expect(mounted.container.textContent).toContain("Sin días libres próximos.");
  });

  it("lista cada excepción con su fecha en español y su motivo cuando existe", () => {
    mounted = renderPanel();

    const items = Array.from(mounted.container.querySelectorAll("li")).map((item) => item.textContent ?? "");
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("octubre");
    expect(items[0]).toContain("12");
    expect(items[0]).toContain("Vacaciones");
    expect(items[1]).toContain("noviembre");
    expect(items[1]).not.toContain("Vacaciones");
  });

  it("exige una fecha antes de registrar el día libre", () => {
    mounted = renderPanel([]);

    click(buttonWithText(mounted.container, "Agregar"));

    expect(mounted.container.textContent).toContain("Selecciona la fecha del día libre.");
    expect(addScheduleExceptionAction).not.toHaveBeenCalled();
  });

  it("no permite elegir fechas anteriores a hoy", () => {
    mounted = renderPanel([]);

    const date = fieldByLabel(mounted.container, "Fecha");
    expect(date.getAttribute("min")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("registra el día libre con su motivo, avisa y limpia el formulario", async () => {
    vi.mocked(addScheduleExceptionAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderPanel([]);

    setFieldValue(fieldByLabel(mounted.container, "Fecha"), "2026-12-24");
    setFieldValue(fieldByLabel(mounted.container, "Motivo (opcional)"), "Viaje familiar");
    click(buttonWithText(mounted.container, "Agregar"));
    await flushAsync();

    expect(addScheduleExceptionAction).toHaveBeenCalledWith("emp-1", "2026-12-24", "Viaje familiar");
    expect(toastMock.success).toHaveBeenCalledWith("Día libre registrado.");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(fieldByLabel(mounted.container, "Fecha").value).toBe("");
    expect(fieldByLabel(mounted.container, "Motivo (opcional)").value).toBe("");
  });

  it("muestra el error de la acción sin avisar con éxito ni refrescar", async () => {
    vi.mocked(addScheduleExceptionAction).mockResolvedValue({ ok: false, error: "Ya existe un día libre en esa fecha" });
    mounted = renderPanel([]);

    setFieldValue(fieldByLabel(mounted.container, "Fecha"), "2026-12-24");
    click(buttonWithText(mounted.container, "Agregar"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("Ya existe un día libre en esa fecha");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(fieldByLabel(mounted.container, "Fecha").value).toBe("2026-12-24");
  });

  it("elimina un día libre y avisa con un toast", async () => {
    vi.mocked(removeScheduleExceptionAction).mockResolvedValue({ ok: true, value: undefined });
    mounted = renderPanel();

    click(buttonWithAriaLabel(mounted.container, "Eliminar día libre"));
    await flushAsync();

    expect(removeScheduleExceptionAction).toHaveBeenCalledWith("emp-1", "ex-1");
    expect(toastMock.success).toHaveBeenCalledWith("Día libre eliminado.");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("muestra con toast de error el fallo al eliminar un día libre", async () => {
    vi.mocked(removeScheduleExceptionAction).mockResolvedValue({ ok: false, error: "El día libre ya no existe" });
    mounted = renderPanel();

    click(buttonWithAriaLabel(mounted.container, "Eliminar día libre"));
    await flushAsync();

    expect(toastMock.error).toHaveBeenCalledWith("El día libre ya no existe");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });
});
