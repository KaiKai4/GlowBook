import type { Page } from "@playwright/test";

/** Fecha ISO (AAAA-MM-DD) dentro de `daysAhead` días. */
export function futureDate(daysAhead = 14): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

/** Abre el selector de fecha `label` y elige `value` (AAAA-MM-DD) navegando por meses. */
export async function selectCalendarDate(page: Page, label: string, value: string): Promise<void> {
  const target = new Date(`${value}T12:00:00`);
  const current = new Date();
  const monthDifference =
    (target.getFullYear() - current.getFullYear()) * 12 +
    target.getMonth() -
    current.getMonth();

  await page.getByLabel(label).click();

  const direction = monthDifference < 0 ? /Mes anterior/i : /Mes siguiente/i;
  for (let index = 0; index < Math.abs(monthDifference); index += 1) {
    await page.getByRole("button", { name: direction }).click();
  }

  const fullDate = new Intl.DateTimeFormat("es-PA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(target);

  await page.getByRole("button", { name: fullDate, exact: true }).click();
}
