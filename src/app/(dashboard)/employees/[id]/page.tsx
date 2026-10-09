import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, KeyRound, Mail, Percent, Phone } from "lucide-react";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { parseUuid } from "@/lib/validation/route-id";
import { getEmployeeDetail } from "@/features/employees/use-cases/get-employee-detail";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteEmployeeButton } from "./delete-employee-button";
import { EditEmployeeModal } from "./edit-employee-modal";
import { EmployeeAccessPanel } from "./employee-access-panel";
import { WorkScheduleEditor } from "./work-schedule-editor";
import { ScheduleExceptionsPanel } from "./schedule-exceptions-panel";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!parseUuid(id)) notFound();

  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para gestionar colaboradores.</p>
      </div>
    );
  }

  const rolesEnabled = await isEffectiveSalonModuleEnabled(profile, "roles");
  const view = await getEmployeeDetail({
    employeeId: id,
    salonId: profile.salon_id,
    rolesEnabled,
  });

  if (!view) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/employees" className="inline-flex items-center gap-1 text-sm text-fg-subtle hover:text-fg">
          <ArrowLeft className="h-4 w-4" />
          Colaboradores
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-fg">
              {view.employee.first_name} {view.employee.last_name}
              {!view.employee.is_active && <Badge variant="default" className="ml-2">Inactivo</Badge>}
            </h1>
            <p className="text-sm text-fg-subtle">
              {view.categories.length > 0
                ? view.categories.map((category) => category.name).join(" · ")
                : "Sin categorías"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EditEmployeeModal
              employee={view.employee}
              categories={view.categoryOptions}
              selectedCategoryIds={view.categories.map((category) => category.id)}
              selectedServiceIds={view.services.map((service) => service.id)}
            />
            <DeleteEmployeeButton
              employeeId={view.employee.id}
              employeeName={`${view.employee.first_name} ${view.employee.last_name}`}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Información</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {view.employee.phone && (
              <p className="flex items-center gap-2 text-fg-muted"><Phone className="h-4 w-4" />{view.employee.phone}</p>
            )}
            {view.employee.email && (
              <p className="flex items-center gap-2 text-fg-muted"><Mail className="h-4 w-4" />{view.employee.email}</p>
            )}
            <p className="flex items-center gap-2 text-fg-muted">
              <Percent className="h-4 w-4" />Comisión: {view.employee.commission_percentage}%
            </p>
            <div className="pt-2">
              <p className="text-xs font-medium text-fg-subtle mb-1">Categorías</p>
              <div className="flex flex-wrap gap-1">
                {view.categories.length ? view.categories.map((category) => (
                  <Badge key={category.id} variant="info">{category.name}</Badge>
                )) : <span className="text-xs text-fg-subtle">Ninguna</span>}
              </div>
            </div>
            <div className="pt-1">
              <p className="text-xs font-medium text-fg-subtle mb-1">Servicios que realiza</p>
              <div className="flex flex-wrap gap-1">
                {view.services.length ? view.services.map((service) => (
                  <Badge key={service.id} variant="primary">{service.name}</Badge>
                )) : <span className="text-xs text-fg-subtle">Ninguno</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Disponibilidad</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <WorkScheduleEditor employeeId={view.employee.id} schedules={view.schedules} />
            <div className="border-t border-border-subtle pt-5">
              <ScheduleExceptionsPanel
                employeeId={view.employee.id}
                exceptions={view.scheduleExceptions}
              />
            </div>
          </CardContent>
        </Card>

        {rolesEnabled ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-brand-500" />
                Acceso al sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeAccessPanel
                employeeId={view.employee.id}
                employeeEmail={view.employee.email}
                profileId={view.employee.profile_id}
                currentRoleId={view.currentRoleId}
                initialInvitation={view.pendingInvitation}
                roles={view.roleOptions}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
