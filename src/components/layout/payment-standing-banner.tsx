import { CalendarClock } from "lucide-react";

/** Datos del aviso de pago vencido en periodo de gracia, ya calculados por el shell del dashboard. */
export interface PaymentGraceNotice {
  overdueSince: string;
  graceDaysLeft: number;
}

// Aviso de pago vencido en periodo de gracia. Vive solo en el dashboard
// (consistente con los avisos de límites): es accionable por el owner, que es
// quien coordina el pago con la plataforma.
export function PaymentStandingBanner({ notice }: { notice: PaymentGraceNotice }) {
  return (
    <div role="status" className="rounded-xl border border-warning-border bg-warning-subtle px-4 py-3">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-warning-fg" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-warning-strong">
            Tu mensualidad venció el {notice.overdueSince}
          </p>
          <p className="mt-1 text-sm text-warning-fg">
            Tienes {notice.graceDaysLeft} {notice.graceDaysLeft === 1 ? "día" : "días"} para
            registrar el pago antes de que el salón se suspenda automáticamente. Contacta a
            GlowBook para registrar tu pago.
          </p>
        </div>
      </div>
    </div>
  );
}
