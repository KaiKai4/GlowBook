import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  PendingAppointmentConfirmation,
  TopService,
} from "@/features/dashboard/use-cases/get-dashboard-overview";

export function PendingConfirmations({ pending }: { pending: PendingAppointmentConfirmation[] }) {
  return (
    <Panel title="Citas por confirmar">
      {pending.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-subtle">No hay citas pendientes de confirmar.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-fg-subtle">Recuérdale a estos clientes que confirmen su cita:</p>
          <ul className="space-y-2.5">
            {pending.map((appointment) => (
              <li
                key={appointment.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg-secondary">{appointment.customerName}</p>
                  <p className="flex items-center gap-1 text-xs text-fg-subtle">
                    <Clock className="h-3 w-3" /> {appointment.when}
                  </p>
                </div>
                <StatusBadge variant="info" label="Agendada" />
              </li>
            ))}
          </ul>
          <Link
            href="/recordatorios"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          >
            Ir a recordatorios <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </>
      )}
    </Panel>
  );
}

export function TopServices({ services }: { services: TopService[] }) {
  return (
    <Panel
      title="Servicios más solicitados"
      actions={<span className="ml-auto text-xs font-normal text-fg-subtle">Este mes</span>}
    >
      {services.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-subtle">Aún no hay datos suficientes este mes.</p>
      ) : (
        <div
          className="relative h-[264px] min-w-0"
          role="img"
          aria-label="Servicios más solicitados este mes"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-2 top-4 bottom-14 flex flex-col justify-between"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <span key={index} className="border-t border-dashed border-brand-100" />
            ))}
          </div>
          <div className="relative flex h-full items-end gap-3 px-2 pt-4">
            {services.map((service) => (
              <div key={service.name} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-3">
                <div className="relative flex h-[198px] w-full items-end justify-center">
                  <div className="pointer-events-none absolute -top-2 z-10 rounded-md bg-fg px-2 py-1 text-xs font-semibold text-surface opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    {service.count}
                  </div>
                  <div
                    className="w-full max-w-10 rounded-t-md bg-brand-600 transition-[height,opacity,transform] duration-150 group-hover:-translate-y-1 group-hover:opacity-90"
                    style={{ height: `${Math.max(service.pct, 12)}%` }}
                  />
                </div>
                <span className="line-clamp-2 min-h-8 text-center text-xs font-medium uppercase leading-tight text-fg-subtle">
                  {service.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
