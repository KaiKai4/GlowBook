import "server-only";

import { sumExpensesTotal } from "../data/expenses.repo";

export async function getManualExpenseTotal(
  salonId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  return sumExpensesTotal(salonId, fromDate, toDate);
}
