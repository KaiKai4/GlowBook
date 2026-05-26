import {
  findEmployeeById,
  updateEmployee,
} from "@/features/employees/data/employees.repo";
import { revokeEmployeeAccessForArchive } from "./employee-access";
import type { Result } from "@/lib/result";

export async function reactivateEmployee(
  employeeId: string,
  salonId: string
): Promise<Result<void>> {
  const employee = await findEmployeeById(employeeId, salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };

  try {
    await updateEmployee(employeeId, salonId, { is_active: true });
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[employees:lifecycle]", err);
    return { ok: false, error: "No se pudo reactivar el colaborador." };
  }
}

export async function archiveEmployee(
  employeeId: string,
  salonId: string
): Promise<Result<{ outcome: "archived"; message: string }>> {
  const employee = await findEmployeeById(employeeId, salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };

  const accessRevoked = await revokeEmployeeAccessForArchive({
    employeeId,
    salonId,
    profileId: employee.profile_id,
  });
  if (!accessRevoked.ok) return accessRevoked;

  try {
    await updateEmployee(employeeId, salonId, {
      is_active: false,
      profile_id: null,
    });

    return {
      ok: true,
      value: {
        outcome: "archived",
        message: "Colaborador archivado conservando su información para trazabilidad.",
      },
    };
  } catch (err) {
    console.error("[employees:lifecycle]", err);
    return { ok: false, error: "No se pudo archivar el colaborador." };
  }
}
