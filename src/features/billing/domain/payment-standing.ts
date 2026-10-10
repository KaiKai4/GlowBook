import type { SalonPlanAssignmentStatus } from "./commercial-plan";

// Estado de pago del salón, evaluado al momento de acceder (lazy): no requiere
// cron. Vencido el periodo pagado (o el trial), corre una ventana de gracia en
// la que el owner ve un aviso; agotada la gracia, el salón queda suspendido
// hasta que la plataforma registre el pago.
type PaymentStandingState = "ok" | "grace" | "suspended";

export interface PaymentStanding {
  state: PaymentStandingState;
  /** Fecha (YYYY-MM-DD) en que vencio el periodo o trial. */
  overdueSince: string | null;
  /** Días de gracia restantes cuando state = "grace". */
  graceDaysLeft: number;
}

const PAYMENT_GRACE_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDate(value: string): number {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getTime();
}

export function evaluatePaymentStanding(input: {
  status: SalonPlanAssignmentStatus | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  todayIso: string;
  graceDays?: number;
}): PaymentStanding {
  const graceDays = input.graceDays ?? PAYMENT_GRACE_DAYS;
  const ok: PaymentStanding = { state: "ok", overdueSince: null, graceDaysLeft: 0 };

  if (!input.status) return ok;
  if (input.status === "paused" || input.status === "canceled") return ok;

  // El trial vence en su fecha; un plan activo vence al final del periodo
  // pagado. past_due usa el mismo periodo como referencia.
  const deadline =
    input.status === "trialing" ? input.trialEndsAt : input.currentPeriodEnd;
  if (!deadline) return ok;

  const today = utcDate(input.todayIso);
  const due = utcDate(deadline);
  if (today <= due) return ok;

  const suspendsAt = due + graceDays * DAY_MS;
  if (today >= suspendsAt) {
    return { state: "suspended", overdueSince: deadline.slice(0, 10), graceDaysLeft: 0 };
  }

  return {
    state: "grace",
    overdueSince: deadline.slice(0, 10),
    graceDaysLeft: Math.ceil((suspendsAt - today) / DAY_MS),
  };
}
