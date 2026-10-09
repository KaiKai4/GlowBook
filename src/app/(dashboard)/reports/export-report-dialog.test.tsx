// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, requireElement } from "@/test/ui-shared-dom";
import { ExportReportDialog } from "./export-report-dialog";

function exportLinks(): HTMLAnchorElement[] {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('[role="dialog"] a'));
}

describe("ExportReportDialog", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("muestra solo el botón de exportar hasta que el usuario lo pulsa", () => {
    mounted = mountComponent(<ExportReportDialog monthKey="2026-05" monthLabel="Mayo 2026" year={2026} />);

    expect(findButtonByText(mounted.container, "Exportar Excel")).toBeInstanceOf(HTMLButtonElement);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("ofrece tres alcances de descarga con sus rutas: mes, año e histórico", () => {
    mounted = mountComponent(<ExportReportDialog monthKey="2026-05" monthLabel="Mayo 2026" year={2026} />);
    clickElement(findButtonByText(mounted.container, "Exportar Excel"));

    const hrefs = exportLinks().map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/api/reports/export?month=2026-05",
      "/api/reports/export?year=2026",
      "/api/reports/export",
    ]);
    for (const link of exportLinks()) {
      expect(link.hasAttribute("download")).toBe(true);
    }
  });

  it("los títulos reflejan el mes y el año recibidos", () => {
    mounted = mountComponent(<ExportReportDialog monthKey="2025-11" monthLabel="Noviembre 2025" year={2025} />);
    clickElement(findButtonByText(mounted.container, "Exportar Excel"));

    const text = exportLinks().map((link) => link.textContent);
    expect(text[0]).toContain("Mes seleccionado (Noviembre 2025)");
    expect(text[1]).toContain("Año 2025");
    expect(text[2]).toContain("Histórico completo");
  });

  it("al elegir una opción de descarga el diálogo se cierra", () => {
    mounted = mountComponent(<ExportReportDialog monthKey="2026-05" monthLabel="Mayo 2026" year={2026} />);
    clickElement(findButtonByText(mounted.container, "Exportar Excel"));

    clickElement(requireElement<HTMLAnchorElement>(document, '[role="dialog"] a[href="/api/reports/export"]'));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("el botón Cerrar del diálogo también lo cierra sin descargar", () => {
    mounted = mountComponent(<ExportReportDialog monthKey="2026-05" monthLabel="Mayo 2026" year={2026} />);
    clickElement(findButtonByText(mounted.container, "Exportar Excel"));

    clickElement(requireElement<HTMLButtonElement>(document, 'button[aria-label="Cerrar"]'));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
