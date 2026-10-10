// Calculos puros de presentacion de reportes: periodo, enlaces de año y rotulos (sin React).
import { formatMonthYear } from "@/infra/format/dates";

export function selectedMonth(from: string): string {
  return from.slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const [year = NaN, monthNumber = NaN] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function monthLabel(month: string): string {
  const [year = NaN, monthNumber = NaN] = month.split("-").map(Number);
  return formatMonthYear(new Date(Date.UTC(year, monthNumber - 1, 15)));
}

/**
 * El año del acumulado solo viaja en la URL si no es el año en curso, para
 * mantener limpia la URL del caso comun.
 */
export function yearQueryParam(year: number, currentYear: number): number | undefined {
  return year === currentYear ? undefined : year;
}

export function expenseSources(modules: { expenses: boolean; inventory: boolean }): string {
  if (modules.expenses && modules.inventory) return "Gastos y reposiciones";
  if (modules.expenses) return "Gastos operativos";
  if (modules.inventory) return "Reposiciones";
  return "Sin módulos de egresos";
}
