"use client";

import { ActiveEmployeeAccessPanel } from "./active-employee-access-panel";
import { PendingEmployeeAccessPanel } from "./pending-employee-access-panel";
import type { PendingEmployeeInvitation, RoleOption } from "../types";

interface EmployeeAccessPanelProps {
  employeeId: string;
  employeeEmail: string;
  profileId: string | null;
  currentRoleId: string | null;
  initialInvitation: PendingEmployeeInvitation | null;
  roles: RoleOption[];
}

export function EmployeeAccessPanel({
  employeeId,
  employeeEmail,
  profileId,
  currentRoleId,
  initialInvitation,
  roles,
}: EmployeeAccessPanelProps) {
  if (profileId) {
    return (
      <ActiveEmployeeAccessPanel
        employeeId={employeeId}
        employeeEmail={employeeEmail}
        profileId={profileId}
        currentRoleId={currentRoleId}
        roles={roles}
      />
    );
  }

  return (
    <PendingEmployeeAccessPanel
      employeeId={employeeId}
      employeeEmail={employeeEmail}
      initialInvitation={initialInvitation}
      roles={roles}
    />
  );
}
