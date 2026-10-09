import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAppointmentDetail } from "@/features/appointments/use-cases/get-appointment-detail";
import { getAppointmentWizardData } from "@/features/appointments/use-cases/get-appointment-wizard-data";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { requireProfile } from "@/infra/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { parseUuid } from "@/infra/validation/route-id";
import { AppointmentEditForm } from "./appointment-edit-form";

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!parseUuid(id)) notFound();

  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para editar citas.</p>
      </div>
    );
  }

  const [appointment, wizardData] = await Promise.all([
    getAppointmentDetail({ appointmentId: id, salonId: profile.salon_id }),
    getAppointmentWizardData(profile.salon_id),
  ]);

  if (!appointment) notFound();

  const isClosed = ["completed", "cancelled", "no_show"].includes(appointment.status);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/appointments"
          className="inline-flex items-center gap-1 text-sm text-fg-subtle hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Agenda
        </Link>
        <div className="mt-2">
          <PageHeader title="Editar cita" description={appointment.customerName} />
        </div>
      </div>

      {isClosed ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-sm text-fg-subtle">
          Esta cita ya está cerrada y no se puede editar.
        </div>
      ) : (
        <AppointmentEditForm
          appointment={appointment}
          categories={wizardData.categories}
          services={wizardData.services}
          employees={wizardData.employees}
          salonConfig={wizardData.salonConfig}
          businessHours={wizardData.businessHours}
        />
      )}
    </div>
  );
}
