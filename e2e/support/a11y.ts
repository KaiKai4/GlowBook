import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Solo los impactos serios y críticos bloquean. Las reglas de axe no se desactivan.
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

/**
 * Analiza la página actual con axe-core y falla si hay violaciones de impacto
 * serious o critical. Llamar tras cada navegación principal.
 */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  // axe mide los colores calculados en ese instante: sin esto, un botón a mitad de
  // transition-colors (p. ej. una pestaña recién activada) da contrastes intermedios
  // falsos. Se mide el estado final, que es lo que ve la persona usuaria.
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
  const results = await new AxeBuilder({ page }).analyze();

  const blocking = results.violations
    .filter(
      (violation) =>
        typeof violation.impact === "string" && BLOCKING_IMPACTS.has(violation.impact)
    )
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 5)
        .map((node) => `${node.target.join(" ")} ${node.html} (${node.failureSummary ?? ""})`)
        .join(" | ");
      return `[${violation.impact}] ${violation.id}: ${violation.help} -> ${targets}`;
    });

  expect(
    blocking,
    `Violaciones de accesibilidad serias o críticas en ${new URL(page.url()).pathname}`
  ).toEqual([]);
}
