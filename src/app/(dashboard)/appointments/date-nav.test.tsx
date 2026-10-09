// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { byAriaLabel, buttonWithText, click, setFieldValue } from "@/test/ui-appointments-dom";
import { DateNav } from "./date-nav";

vi.mock("@/components/ui/date-picker", () => import("@/test/ui-appointments-pickers"));

type Change = { date: string; view: "diaria" | "semanal" | "trabajador" };

describe("DateNav", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function render(props: Partial<Parameters<typeof DateNav>[0]> & { onChange: (next: Change) => void }) {
    mounted = mountComponent(
      <DateNav date="2026-10-12" view="diaria" {...props} />
    );
    return mounted.container;
  }

  it("ofrece las tres vistas cuando el salón tiene vista por trabajador", () => {
    const container = render({ onChange: vi.fn() });

    const labels = Array.from(container.querySelectorAll("button"))
      .map((button) => button.textContent?.trim())
      .filter((text) => text === "Diaria" || text === "Semanal" || text === "Por trabajador");
    expect(labels).toEqual(["Diaria", "Semanal", "Por trabajador"]);
  });

  it("oculta la vista por trabajador cuando el salón no la habilita", () => {
    const container = render({ showWorkerView: false, onChange: vi.fn() });

    expect(container.textContent).toContain("Semanal");
    expect(container.textContent).not.toContain("Por trabajador");
  });

  it("marca como activa la vista actual y cambia a otra vista conservando la fecha", () => {
    const onChange = vi.fn();
    const container = render({ view: "diaria", onChange });

    expect(buttonWithText(container, "Diaria").className).toContain("text-brand-700");
    expect(buttonWithText(container, "Semanal").className).toContain("text-fg-subtle");

    click(buttonWithText(container, "Semanal"));

    expect(onChange).toHaveBeenCalledWith({ date: "2026-10-12", view: "semanal" });
  });

  it("avanza un día en vista diaria y retrocede un día con la flecha anterior", () => {
    const onChange = vi.fn();
    const container = render({ date: "2026-10-12", view: "diaria", onChange });

    click(byAriaLabel(container, "Día siguiente"));
    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-10-13", view: "diaria" });

    click(byAriaLabel(container, "Día anterior"));
    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-10-11", view: "diaria" });
  });

  it("salta de semana en semana en vista semanal", () => {
    const onChange = vi.fn();
    const container = render({ date: "2026-10-12", view: "semanal", onChange });

    expect(byAriaLabel(container, "Semana anterior")).toBeInstanceOf(HTMLButtonElement);
    click(byAriaLabel(container, "Semana siguiente"));
    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-10-19", view: "semanal" });

    click(byAriaLabel(container, "Semana anterior"));
    expect(onChange).toHaveBeenLastCalledWith({ date: "2026-10-05", view: "semanal" });
  });

  it("cruza el cambio de mes al avanzar desde el último día del mes", () => {
    const onChange = vi.fn();
    const container = render({ date: "2026-10-31", view: "diaria", onChange });

    click(byAriaLabel(container, "Día siguiente"));

    expect(onChange).toHaveBeenCalledWith({ date: "2026-11-01", view: "diaria" });
  });

  it("emite la nueva fecha elegida en el selector conservando la vista activa", () => {
    const onChange = vi.fn();
    const container = render({ date: "2026-10-12", view: "trabajador", onChange });

    const picker = byAriaLabel<HTMLInputElement>(container, "Fecha de la agenda");
    expect(picker.value).toBe("2026-10-12");

    setFieldValue(picker, "2026-10-20");

    expect(onChange).toHaveBeenCalledWith({ date: "2026-10-20", view: "trabajador" });
  });

  it("deshabilita navegación, selector y vistas mientras la agenda carga", () => {
    const onChange = vi.fn();
    const container = render({ loading: true, onChange });

    expect(byAriaLabel<HTMLButtonElement>(container, "Día anterior").disabled).toBe(true);
    expect(byAriaLabel<HTMLButtonElement>(container, "Día siguiente").disabled).toBe(true);
    expect(byAriaLabel<HTMLInputElement>(container, "Fecha de la agenda").disabled).toBe(true);
    expect(buttonWithText(container, "Semanal").disabled).toBe(true);
  });
});
