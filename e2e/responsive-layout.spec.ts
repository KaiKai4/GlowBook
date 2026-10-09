import { expect, test, type Page } from "@playwright/test";
import { isLocalTarget, skipUnlessReady } from "./support/env";
import { loginWith } from "./support/login";
import { readLocalFixtures } from "./support/local-fixtures";
import { OWNER_SCREENS } from "./support/routes";

// Sin scroll horizontal de documento a 375 px (móvil) y 1280 px (escritorio) en cada pantalla
// del panel del salón, incluidas las que tienen tablas.
const WIDTHS = [375, 1280] as const;

async function expectNoHorizontalScroll(page: Page, path: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await expect(page.locator("h1, h2").first()).toBeVisible();

  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement;
    if (!root) throw new Error("document.scrollingElement no disponible");
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
  });

  expect(
    metrics.scrollWidth,
    `Scroll horizontal en ${path} a ${width} px (scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth})`
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

test.describe("layout responsive: sin scroll horizontal", () => {
  test.beforeEach(async ({ page }) => {
    skipUnlessReady(!isLocalTarget, "El control de layout requiere el stack local.");
    const owner = readLocalFixtures().salonOwnerA;
    await loginWith(page, owner.email, owner.password);
  });

  for (const screen of OWNER_SCREENS) {
    for (const width of WIDTHS) {
      test(`${screen.path} a ${width} px no desborda horizontalmente`, async ({ page }) => {
        await expectNoHorizontalScroll(page, screen.path, width);
      });
    }
  }
});
