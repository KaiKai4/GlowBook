import "server-only";

import { findEmployees } from "../data/employees.repo";

interface EmployeeSchedulingWorkSchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface EmployeeSchedulingOption {
  id: string;
  name: string;
  service_ids: string[];
  category_ids: string[];
  work_schedules: EmployeeSchedulingWorkSchedule[];
}

type AssignedRef = {
  service?: { id: string } | null;
  category?: { id: string } | null;
};

type WorkScheduleRef = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export async function getEmployeeSchedulingOptions(
  salonId: string,
  activeServiceIds?: Set<string>
): Promise<EmployeeSchedulingOption[]> {
  const employees = await findEmployees(salonId, true);

  return employees.map((employee) => ({
    id: employee.id,
    name: `${employee.first_name} ${employee.last_name}`.trim(),
    service_ids: ((employee.services ?? []) as AssignedRef[])
      .map((service) => service.service?.id)
      .filter((id): id is string => {
        if (typeof id !== "string") return false;
        return activeServiceIds ? activeServiceIds.has(id) : true;
      }),
    category_ids: ((employee.categories ?? []) as AssignedRef[])
      .map((category) => category.category?.id)
      .filter((id): id is string => Boolean(id)),
    work_schedules: ((employee.work_schedules ?? []) as WorkScheduleRef[]).map((schedule) => ({
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      is_active: schedule.is_active,
    })),
  }));
}
