import "server-only";

import { findActiveEmployeeNames } from "../data/employees.repo";

export interface EmployeeCalendarOption {
  id: string;
  first_name: string;
  last_name: string;
}

export async function getEmployeeCalendarOptions(
  salonId: string
): Promise<EmployeeCalendarOption[]> {
  return findActiveEmployeeNames(salonId);
}
