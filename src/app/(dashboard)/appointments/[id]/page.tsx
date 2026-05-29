import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findAppointmentById } from "@/features/appointments/data/appointments.repo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatTimeTz } from "@/lib/utils/dates";
import { AppointmentActions } from "./appointment-actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Completada",
  cancelled: "Cancelada", no_show: "No asistió",
};
const STATUS_VARIANT: Record<string, "info" | "success" | "danger" | "warning" | "primary"> = {
  scheduled: "info", confirmed: "primary", completed: "success",
  cancelled: "danger", no_show: "warning",
};

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const canManage = hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE);
  const canView = canManage || hasPermission(profile, PERMISSIONS.APPOINTMENTS_VIEW);

  if (!canView) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para ver las citas.</p>
      </div>
    );
  }

  const appt = await findAppointmentById(id);
  if (!appt || appt.salon_id !== profile.salon_id) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: salon } = await supabase
    .from("salons").select("timezone").eq("id", profile.salon_id).single();
  const tz = salon?.timezone ?? "America/Panama";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <Link href="/appointments" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
          <ArrowLeft className="h-4 w-4" />
          Agenda
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">
            {appt.customer?.first_name} {appt.customer?.last_name}
          </h1>
          <Badge variant={STATUS_VARIANT[appt.status]}>{STATUS_LABEL[appt.status]}</Badge>
        </div>
        {appt.start_time && (
          <p className="text-sm text-neutral-500 mt-1">
            {formatDate(new Date(appt.start_time))} · {formatTimeTz(new Date(appt.start_time), tz)}
            {appt.end_time && ` – ${formatTimeTz(new Date(appt.end_time), tz)}`}
          </p>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Servicios</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-neutral-100">
            {appt.items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{item.service?.name}</p>
                  <p className="text-xs text-neutral-500">
                    {formatTimeTz(new Date(item.start_time), tz)}–{formatTimeTz(new Date(item.end_time), tz)} ·{" "}
                    {item.employee?.first_name} {item.employee?.last_name}
                  </p>
                </div>
                <span className="text-sm text-neutral-700">{formatCurrency(Number(item.price))}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 font-semibold text-neutral-900">
            <span>Total</span>
            <span>{formatCurrency(Number(appt.total_price))}</span>
          </div>
        </CardContent>
      </Card>

      {appt.notes && (
        <Card>
          <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-neutral-600">{appt.notes}</p></CardContent>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader><CardTitle>Acciones</CardTitle></CardHeader>
          <CardContent>
            <AppointmentActions appointmentId={appt.id} status={appt.status} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
