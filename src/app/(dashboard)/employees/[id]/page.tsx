import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findEmployeeById, findLatestEmployeeInvitation } from "@/features/employees/data/employees.repo";
import { findCategoriesWithServices } from "@/features/services/data/services.repo";
import { findRolesWithPermissions } from "@/features/access/data/roles.repo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkScheduleEditor } from "./work-schedule-editor";
import { EmployeeAccessPanel } from "./employee-access-panel";
import { DeleteEmployeeButton } from "./delete-employee-button";
import { EditEmployeeModal } from "./edit-employee-modal";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Percent, KeyRound } from "lucide-react";

interface AssignedService { service: { id: string; name: string } | null }
interface AssignedCategory { category: { id: string; name: string } | null }

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;

  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-400">No tienes permiso para gestionar colaboradores.</p>
      </div>
    );
  }

  const [employee, allRoles, allCategories] = await Promise.all([
    findEmployeeById(id, profile.salon_id),
    findRolesWithPermissions(profile.salon_id),
    findCategoriesWithServices(profile.salon_id),
  ]);

  if (!employee) notFound();

  const services = ((employee.services ?? []) as AssignedService[])
    .map((s) => s.service)
    .filter((s): s is { id: string; name: string } => s !== null);
  const categories = ((employee.categories ?? []) as AssignedCategory[])
    .map((c) => c.category)
    .filter((c): c is { id: string; name: string } => c !== null);
  const schedules = (employee.work_schedules ?? []).map((w) => ({
    id: w.id,
    day_of_week: w.day_of_week,
    start_time: w.start_time,
    end_time: w.end_time,
  }));

  const roleOptions = allRoles
    .filter((r) => !r.is_system)
    .map((r) => ({ id: r.id, name: r.name }));
  const categoryOptions = allCategories.map((category) => ({
    id: category.id,
    name: category.name,
    services: (category.services ?? []).map((service) => ({
      id: service.id,
      name: service.name,
    })),
  }));

  let currentRoleId: string | null = null;
  if (employee.profile_id) {
    const supabase = await createSupabaseServerClient();
    const { data: linkedProfile } = await supabase
      .from("profiles")
      .select("role_id")
      .eq("id", employee.profile_id)
      .single();
    currentRoleId = linkedProfile?.role_id ?? null;
  }

  const invitation = !employee.profile_id
    ? await findLatestEmployeeInvitation(id, profile.salon_id)
    : null;

  const pendingInvitation =
    invitation && !invitation.accepted_at && new Date(invitation.expires_at) >= new Date()
      ? { token: invitation.token, expiresAt: invitation.expires_at, roleId: invitation.role_id }
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/employees" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
          <ArrowLeft className="h-4 w-4" />
          Colaboradores
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
              {employee.first_name} {employee.last_name}
              {!employee.is_active && <Badge variant="default" className="ml-2">Inactivo</Badge>}
            </h1>
            <p className="text-sm text-neutral-500">
              {categories.length > 0 ? categories.map((c) => c.name).join(" · ") : "Sin categorías"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EditEmployeeModal
              employee={{
                id: employee.id,
                first_name: employee.first_name,
                last_name: employee.last_name,
                phone: employee.phone ?? "",
                email: employee.email ?? "",
                specialty: employee.specialty ?? "",
                commission_percentage: Number(employee.commission_percentage ?? 0),
              }}
              categories={categoryOptions}
              selectedCategoryIds={categories.map((category) => category.id)}
              selectedServiceIds={services.map((service) => service.id)}
            />
            <DeleteEmployeeButton
              employeeId={employee.id}
              employeeName={`${employee.first_name} ${employee.last_name}`}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Información</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {employee.phone && (
              <p className="flex items-center gap-2 text-neutral-600"><Phone className="h-4 w-4" />{employee.phone}</p>
            )}
            {employee.email && (
              <p className="flex items-center gap-2 text-neutral-600"><Mail className="h-4 w-4" />{employee.email}</p>
            )}
            <p className="flex items-center gap-2 text-neutral-600">
              <Percent className="h-4 w-4" />Comisión: {employee.commission_percentage}%
            </p>
            <div className="pt-2">
              <p className="text-xs font-medium text-neutral-500 mb-1">Categorías</p>
              <div className="flex flex-wrap gap-1">
                {categories.length ? categories.map((c) => (
                  <Badge key={c.id} variant="info">{c.name}</Badge>
                )) : <span className="text-xs text-neutral-400">Ninguna</span>}
              </div>
            </div>
            <div className="pt-1">
              <p className="text-xs font-medium text-neutral-500 mb-1">Servicios que realiza</p>
              <div className="flex flex-wrap gap-1">
                {services.length ? services.map((s) => (
                  <Badge key={s.id} variant="primary">{s.name}</Badge>
                )) : <span className="text-xs text-neutral-400">Ninguno</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Disponibilidad</CardTitle></CardHeader>
          <CardContent>
            <WorkScheduleEditor employeeId={employee.id} schedules={schedules} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-500" />
              Acceso al sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmployeeAccessPanel
              employeeId={employee.id}
              employeeEmail={employee.email ?? ""}
              profileId={employee.profile_id}
              currentRoleId={currentRoleId}
              initialInvitation={pendingInvitation}
              roles={roleOptions}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
