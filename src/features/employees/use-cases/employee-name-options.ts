import "server-only";

import { findActiveEmployeeNames } from "../data/employees.repo";

export interface EmployeeNameOption {
  id: string;
  name: string;
}

export async function getActiveEmployeeNameOptions(
  salonId: string
): Promise<EmployeeNameOption[]> {
  const employees = await findActiveEmployeeNames(salonId);

  return employees.map((employee) => ({
    id: employee.id,
    name: `${employee.first_name} ${employee.last_name}`.trim(),
  }));
}
