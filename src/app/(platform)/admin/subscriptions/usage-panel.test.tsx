// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, getButtonByText } from "@/test/ui-admin-dom";
import { CATALOG_MODULES, makeDetail, makeLimit } from "@/test/ui-admin-fixtures";
import { UsagePanel } from "./usage-panel";

vi.mock("./actions", () => ({ resolveAlertAction: vi.fn() }));

describe("UsagePanel", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("pide asignar un plan cuando el salón no tiene uno", () => {
    mounted = mountComponent(
      <UsagePanel detail={makeDetail({ plan: null, limits: [], enabledModules: [] })} modules={CATALOG_MODULES} />
    );

    expect(mounted.container.textContent).toContain("Asigna un plan para ver el consumo de límites");
    expect(mounted.container.textContent).not.toContain("Consumo de límites");
  });

  it("muestra el uso frente al máximo con su unidad y el porcentaje", () => {
    mounted = mountComponent(
      <UsagePanel
        detail={makeDetail({ limits: [makeLimit({ used: 40, maxValue: 100, percentage: 40 })] })}
        modules={CATALOG_MODULES}
      />
    );

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Citas");
    expect(text).toContain("Mes calendario");
    expect(text).toContain("40 / 100 citas");
    expect(text).toContain("(40%)");
  });

  it("indica 'sin límite' cuando el máximo es nulo y no dibuja una barra de progreso", () => {
    mounted = mountComponent(
      <UsagePanel
        detail={makeDetail({ limits: [makeLimit({ maxValue: null, percentage: null, used: 7 })] })}
        modules={CATALOG_MODULES}
      />
    );

    expect(mounted.container.textContent).toContain("7 / sin límite");
    expect(mounted.container.querySelector('div[style*="width"]')).toBeNull();
  });

  it("limita el ancho de la barra al 100% aunque el uso supere el máximo", () => {
    mounted = mountComponent(
      <UsagePanel
        detail={makeDetail({
          limits: [makeLimit({ used: 130, maxValue: 100, percentage: 130, warningLevel: "over_limit", message: "Superaste el límite" })],
        })}
        modules={CATALOG_MODULES}
      />
    );

    const bar = mounted.container.querySelector<HTMLElement>('div[style*="width"]');
    expect(bar?.style.width).toBe("100%");
    expect(bar?.className).toContain("bg-danger");
  });

  it("usa tono de advertencia cuando el límite está cerca y de peligro cuando está bloqueado", () => {
    mounted = mountComponent(
      <UsagePanel
        detail={makeDetail({
          limits: [
            makeLimit({ warningLevel: "near_limit", percentage: 85, used: 85, message: "Cerca del límite" }),
          ],
        })}
        modules={CATALOG_MODULES}
      />
    );

    const bar = mounted.container.querySelector<HTMLElement>('div[style*="width"]');
    expect(bar?.className).toContain("bg-warning");
    expect(mounted.container.textContent).toContain("Cerca del límite");
  });

  it("ofrece ampliar el límite con un extra y avisa con la clave de la métrica", () => {
    const onExpandLimit = vi.fn();
    mounted = mountComponent(
      <UsagePanel
        detail={makeDetail({
          limits: [makeLimit({ warningLevel: "blocked", percentage: 100, used: 100, message: "Bloqueado" })],
        })}
        modules={CATALOG_MODULES}
        onExpandLimit={onExpandLimit}
      />
    );

    clickElement(getButtonByText(mounted.container, "Ampliar límite con un extra"));

    expect(onExpandLimit).toHaveBeenCalledWith("appointments_monthly");
  });

  it("no muestra el botón de ampliar cuando no se pasa el callback", () => {
    mounted = mountComponent(
      <UsagePanel
        detail={makeDetail({
          limits: [makeLimit({ warningLevel: "near_limit", message: "Cerca" })],
        })}
        modules={CATALOG_MODULES}
      />
    );

    expect(mounted.container.textContent).not.toContain("Ampliar límite con un extra");
  });

  it("lista las alertas abiertas con su mensaje y un formulario para resolverlas", () => {
    mounted = mountComponent(
      <UsagePanel
        detail={makeDetail({
          openAlerts: [
            { id: "alert-1", severity: "danger", message: "Sin cupo de citas", createdAt: "2026-10-02" },
            { id: "alert-2", severity: "info", message: "Recordatorio de renovación", createdAt: "2026-10-03" },
          ],
        })}
        modules={CATALOG_MODULES}
      />
    );

    expect(mounted.container.textContent).toContain("Alertas abiertas");
    expect(mounted.container.textContent).toContain("Sin cupo de citas");
    expect(mounted.container.textContent).toContain("Recordatorio de renovación");
    expect(mounted.container.querySelectorAll("form")).toHaveLength(2);
    const dangerDot = mounted.container.querySelector("span.rounded-full.bg-danger");
    expect(dangerDot).not.toBeNull();
    expect(mounted.container.querySelector("span.rounded-full.bg-info")).not.toBeNull();
  });

  it("no muestra el panel de alertas cuando no hay alertas abiertas", () => {
    mounted = mountComponent(<UsagePanel detail={makeDetail()} modules={CATALOG_MODULES} />);

    expect(mounted.container.textContent).not.toContain("Alertas abiertas");
  });

  it("indica que el plan no tiene límites cuando la lista está vacía", () => {
    mounted = mountComponent(<UsagePanel detail={makeDetail({ limits: [] })} modules={CATALOG_MODULES} />);

    expect(mounted.container.textContent).toContain("El plan no tiene límites configurados.");
  });

  it("marca como activos solo los módulos habilitados para el salón", () => {
    mounted = mountComponent(
      <UsagePanel detail={makeDetail({ enabledModules: ["appointments", "reports"] })} modules={CATALOG_MODULES} />
    );

    const rows = Array.from(mounted.container.querySelectorAll("div.rounded-xl.border")).filter((el) =>
      el.className.includes("justify-between")
    );
    const statusByName = Object.fromEntries(
      rows.map((row) => [row.querySelector("span")?.textContent ?? "", row.querySelectorAll("span")[1]?.textContent ?? ""])
    );
    expect(statusByName).toEqual({ Agenda: "Activo", Gastos: "Off", Reportes: "Activo" });
  });

  // Regresión: la migración a tokens había convertido "text-xs" en la clase
  // inexistente "undefineds". El porcentaje debe conservar el tamaño de la escala.
  it("renderiza el porcentaje con text-xs y sin clases inválidas", () => {
    mounted = mountComponent(
      <UsagePanel detail={makeDetail({ limits: [makeLimit({ used: 40, percentage: 40 })] })} modules={CATALOG_MODULES} />
    );

    const percentage = Array.from(mounted.container.querySelectorAll("span")).find(
      (span) => span.textContent === "(40%)"
    );
    expect(percentage?.className).toContain("text-xs");
    expect(mounted.container.innerHTML).not.toMatch(/undefined[a-z-]*/);
  });
});
