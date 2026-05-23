import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findEmployeeById } from "@/features/employees/data/employees.repo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkScheduleEditor } from "./work-schedule-editor";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Percent } from "lucide-react";

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

  const employee = await findEmployeeById(id, profile.salon_id);
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/employees" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
          <ArrowLeft className="h-4 w-4" />
          Colaboradores
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 mt-2">
          {employee.first_name} {employee.last_name}
          {!employee.is_active && <Badge variant="default" className="ml-2">Inactivo</Badge>}
        </h1>
        <p className="text-sm text-neutral-500">
          {categories.length > 0 ? categories.map((c) => c.name).join(" · ") : "Sin categorías"}
        </p>
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
      </div>
    </div>
  );
}
