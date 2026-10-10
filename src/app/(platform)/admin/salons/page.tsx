import { AlertTriangle, Building2, CalendarDays, Users } from "lucide-react";

import { getSalonSubscriptionDetail } from "@/features/billing";
import { getSubscriptionsPage } from "@/features/billing";
import { getPlatformSalonOverviews } from "@/features/platform";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import { SalonSubscriptionList } from "../subscriptions/salon-list";
import { SalonWorkspace } from "./salon-workspace";

export default async function PlatformSalonsPage({
  searchParams,
}: {
  searchParams?: Promise<{ salon?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const view = await getPlatformSalonOverviews();
  const data = await getSubscriptionsPage(view.salons);

  const selectedSalon =
    view.salons.find((salon) => salon.id === params?.salon) ?? view.salons[0] ?? null;
  const selectedRow = selectedSalon
    ? data.rows.find((row) => row.salonId === selectedSalon.id) ?? null
    : null;
  const detail = selectedSalon ? await getSalonSubscriptionDetail(selectedSalon.id) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Salones"
        description="Informacion global de cada salon: contacto, plan asignado, consumo de límites y acciones de plataforma."
        actions={
          <>
            <HeaderMetric icon={<Building2 className="h-4 w-4" />} label="Salones" value={view.metrics.totalSalons} />
            <HeaderMetric
              icon={<Users className="h-4 w-4" />}
              label="Activos"
              value={view.metrics.activeSalons}
              accent="success"
            />
            <HeaderMetric icon={<CalendarDays className="h-4 w-4" />} label="Citas totales" value={view.metrics.totalAppointments} />
            <HeaderMetric
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Alertas"
              value={data.totals.openAlerts}
              accent={data.totals.openAlerts > 0 ? "warning" : "default"}
            />
          </>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-surface shadow-soft">
        <div className="grid h-[calc(100vh-210px)] min-h-[540px] lg:grid-cols-[320px_1fr]">
          <aside className="flex min-h-0 flex-col border-b border-brand-100 bg-surface-muted/60 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Salones</p>
                <p className="mt-1 text-sm text-fg-subtle">{view.salons.length} registrados</p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {view.metrics.activeSalons} activos
              </span>
            </div>
            <SalonSubscriptionList
              rows={data.rows}
              selectedSalonId={selectedSalon?.id ?? null}
              hrefBase="/admin/salons"
            />
          </aside>

          {selectedSalon && detail ? (
            <SalonWorkspace
              salon={{
                id: selectedSalon.id,
                name: selectedSalon.name,
                contactEmail: selectedSalon.contact_email,
                phone: selectedSalon.phone,
                isActive: selectedSalon.is_active,
                createdAtLabel: formatRegistrationDate(selectedSalon.created_at),
                ownerNames: selectedSalon.owner_names,
                customerCount: selectedSalon.customer_count,
                collaboratorCount: selectedSalon.collaborator_count,
                appointmentCount: selectedSalon.appointment_count,
                serviceCount: selectedSalon.service_count,
              }}
              row={selectedRow}
              detail={detail}
              modules={data.modules}
            />
          ) : (
            <div className="flex items-center justify-center p-8">
              <p className="max-w-sm text-center text-sm leading-6 text-fg-subtle">
                No hay salones registrados. Invita un salon desde Invitaciones para empezar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRegistrationDate(value: string): string {
  return new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function HeaderMetric({
  icon,
  label,
  value,
  accent = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: "default" | "success" | "warning";
}) {
  return (
    <div className="inline-flex h-11 items-center gap-3 rounded-xl border border-brand-100 bg-surface px-4 shadow-sm">
      <span className={accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-brand-600"}>
        {icon}
      </span>
      <span className="text-xl font-semibold text-fg-strong">{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{label}</span>
    </div>
  );
}
