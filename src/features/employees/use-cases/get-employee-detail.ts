import "server-only";
import { captureError } from "@/lib/observability";

import { getAssignableRoleOptions } from "@/features/access/use-cases/role-options";
import { getCategoryServiceOptions } from "@/features/services/use-cases/category-service-options";
import { findEmployeeAccessProfile } from "../data/employee-access.repo";
import { findUpcomingEmployeeExceptions } from "../data/employee-exceptions.repo";
import { findEmployeeById, findLatestEmployeeInvitation } from "../data/employees.repo";

type AssignedServiceRef = {
  service: { id: string; name: string } | null;
};

type AssignedCategoryRef = {
  category: { id: string; name: string } | null;
};

export interface EmployeeDetailEmployeeViewModel {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  specialty: string;
  commission_percentage: number;
  profile_id: string | null;
  is_active: boolean;
}

export interface EmployeeDetailNamedRef {
  id: string;
  name: string;
}

export interface EmployeeDetailSchedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface EmployeeDetailCategoryOption {
  id: string;
  name: string;
  services: EmployeeDetailNamedRef[];
}

export interface EmployeeDetailRoleOption {
  id: string;
  name: string;
}

export interface EmployeeDetailPendingInvitation {
  expiresAt: string;
  roleId: string | null;
}

export interface EmployeeDetailScheduleException {
  id: string;
  date: string;
  reason: string;
}

export interface EmployeeDetailViewModel {
  employee: EmployeeDetailEmployeeViewModel;
  services: EmployeeDetailNamedRef[];
  categories: EmployeeDetailNamedRef[];
  schedules: EmployeeDetailSchedule[];
  scheduleExceptions: EmployeeDetailScheduleException[];
  categoryOptions: EmployeeDetailCategoryOption[];
  roleOptions: EmployeeDetailRoleOption[];
  currentRoleId: string | null;
  pendingInvitation: EmployeeDetailPendingInvitation | null;
}

export interface GetEmployeeDetailInput {
  employeeId: string;
  salonId: string;
  rolesEnabled: boolean;
  now?: Date;
}

async function getCurrentRoleId(
  profileId: string | null,
  salonId: string
): Promise<string | null> {
  if (!profileId) return null;

  const { data, error } = await findEmployeeAccessProfile(profileId, salonId);
  if (error) {
    captureError(error, { module: "employees", action: "detail" });
    return null;
  }

  return data?.role_id ?? null;
}

function toPendingInvitation(
  invitation: Awaited<ReturnType<typeof findLatestEmployeeInvitation>>,
  now: Date
): EmployeeDetailPendingInvitation | null {
  if (!invitation || invitation.accepted_at) return null;
  if (new Date(invitation.expires_at).getTime() < now.getTime()) return null;

  return {
    expiresAt: invitation.expires_at,
    roleId: invitation.role_id,
  };
}

export async function getEmployeeDetail({
  employeeId,
  salonId,
  rolesEnabled,
  now = new Date(),
}: GetEmployeeDetailInput): Promise<EmployeeDetailViewModel | null> {
  const [employee, allRoles, allCategories] = await Promise.all([
    findEmployeeById(employeeId, salonId),
    rolesEnabled ? getAssignableRoleOptions(salonId) : Promise.resolve([]),
    getCategoryServiceOptions(salonId),
  ]);

  if (!employee) return null;

  const [currentRoleId, invitation, scheduleExceptions] = await Promise.all([
    getCurrentRoleId(employee.profile_id, salonId),
    employee.profile_id
      ? Promise.resolve(null)
      : findLatestEmployeeInvitation(employeeId, salonId),
    findUpcomingEmployeeExceptions(employeeId, salonId),
  ]);

  const services = ((employee.services ?? []) as AssignedServiceRef[])
    .map((assignment) => assignment.service)
    .filter((service): service is EmployeeDetailNamedRef => service !== null);
  const categories = ((employee.categories ?? []) as AssignedCategoryRef[])
    .map((assignment) => assignment.category)
    .filter((category): category is EmployeeDetailNamedRef => category !== null);

  return {
    employee: {
      id: employee.id,
      first_name: employee.first_name,
      last_name: employee.last_name,
      phone: employee.phone ?? "",
      email: employee.email ?? "",
      specialty: employee.specialty ?? "",
      commission_percentage: Number(employee.commission_percentage ?? 0),
      profile_id: employee.profile_id,
      is_active: employee.is_active,
    },
    services,
    categories,
    schedules: (employee.work_schedules ?? []).map((schedule) => ({
      id: schedule.id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    })),
    scheduleExceptions: scheduleExceptions.map((exception) => ({
      id: exception.id,
      date: exception.exception_date,
      reason: exception.reason,
    })),
    categoryOptions: allCategories,
    roleOptions: allRoles,
    currentRoleId,
    pendingInvitation: toPendingInvitation(invitation, now),
  };
}
