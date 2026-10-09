import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Solo los impactos serios y críticos bloquean. Las reglas de axe no se desactivan.
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

/**
 * Analiza la página actual con axe-core y falla si hay violaciones de impacto
 * serious o critical. Llamar tras cada navegación principal.
 */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();

  const blocking = results.violations
    .filter(
      (violation) =>
        typeof violation.impact === "string" && BLOCKING_IMPACTS.has(violation.impact)
    )
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 5)
        .map((node) => node.target.join(" "))
        .join(" | ");
      return `[${violation.impact}] ${violation.id}: ${violation.help} -> ${targets}`;
    });

  expect(
    blocking,
    `Violaciones de accesibilidad serias o críticas en ${new URL(page.url()).pathname}`
  ).toEqual([]);
}
