import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAppointmentDetail } from "@/features/appointments/use-cases/get-appointment-detail";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { formatCurrency, formatDate, formatTimeTz } from "@/lib/utils/dates";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentActions } from "./appointment-actions";

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

  const appointment = await getAppointmentDetail({
    appointmentId: id,
    salonId: profile.salon_id,
  });

  if (!appointment) notFound();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <Link href="/appointments" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
          <ArrowLeft className="h-4 w-4" />
          Agenda
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">{appointment.customerName}</h1>
          <Badge variant={appointment.statusVariant}>{appointment.statusLabel}</Badge>
        </div>
        {appointment.start_time && (
          <p className="text-sm text-neutral-500 mt-1">
            {formatDate(new Date(appointment.start_time))} · {formatTimeTz(new Date(appointment.start_time), appointment.timezone)}
            {appointment.end_time && ` – ${formatTimeTz(new Date(appointment.end_time), appointment.timezone)}`}
          </p>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Servicios</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-neutral-100">
            {appointment.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{item.serviceName}</p>
                  <p className="text-xs text-neutral-500">
                    {formatTimeTz(new Date(item.start_time), appointment.timezone)}–{formatTimeTz(new Date(item.end_time), appointment.timezone)} ·{" "}
                    {item.employeeName}
                  </p>
                </div>
                <span className="text-sm text-neutral-700">{formatCurrency(item.price)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 font-semibold text-neutral-900">
            <span>Total</span>
            <span>{formatCurrency(appointment.total_price)}</span>
          </div>
        </CardContent>
      </Card>

      {appointment.notes && (
        <Card>
          <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-neutral-600">{appointment.notes}</p></CardContent>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader><CardTitle>Acciones</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!["completed", "cancelled", "no_show"].includes(appointment.status) && (
              <Link
                href={`/appointments/${appointment.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Editar / reprogramar
              </Link>
            )}
            <AppointmentActions appointmentId={appointment.id} status={appointment.status} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
