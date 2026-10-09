import Link from "next/link";
import { getAppointmentWizardData } from "@/features/appointments/use-cases/get-appointment-wizard-data";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireProfile } from "@/app/_composition/request-context";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AppointmentWizard } from "./appointment-wizard";

export default async function NewAppointmentPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para crear citas.</p>
      </div>
    );
  }

  const wizardData = await getAppointmentWizardData(profile.salon_id);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/appointments" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Agenda
        </Link>
        <div className="mt-2">
          <PageHeader title="Nueva cita" description="Completa los pasos para agendar una cita." />
        </div>
      </div>

      {!wizardData.ready ? (
        <div className="rounded-xl border border-warning-border bg-warning-subtle p-5 text-sm text-warning-strong shadow-sm">
          Para agendar necesitas al menos un servicio y un colaborador que lo realice.
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {wizardData.services.length === 0 && (
              <li>No hay servicios. <Link href="/services" className="underline font-medium">Crear servicio</Link></li>
            )}
            {wizardData.employees.length === 0 && (
              <li>No hay colaboradores. <Link href="/employees" className="underline font-medium">Crear colaborador</Link></li>
            )}
          </ul>
        </div>
      ) : (
        <AppointmentWizard
          customers={wizardData.customers}
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
