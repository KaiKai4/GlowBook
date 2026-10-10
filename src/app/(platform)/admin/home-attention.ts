import type { SalonSubscriptionRow } from "@/features/billing/domain/salon-subscription-rows";

export interface AttentionItem {
  salonId: string;
  salonName: string;
  reason: string;
  detail: string;
  severity: "warning" | "danger";
}

export function buildAttentionList(rows: SalonSubscriptionRow[]): AttentionItem[] {
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const soonIso = soon.toISOString().slice(0, 10);
  const items: AttentionItem[] = [];

  for (const row of rows) {
    if (row.openAlertCount > 0) {
      items.push({
        salonId: row.salonId,
        salonName: row.salonName,
        reason: "Límites",
        detail: `${row.openAlertCount} alerta${row.openAlertCount === 1 ? "" : "s"} de límite abierta${row.openAlertCount === 1 ? "" : "s"}.`,
        severity: "danger",
      });
    }
    if (row.status === "past_due") {
      items.push({
        salonId: row.salonId,
        salonName: row.salonName,
        reason: "Moroso",
        detail: "Pago vencido: registra el pago o pausa la suscripcion.",
        severity: "danger",
      });
    }
    if (row.status === "trialing" && row.trialEndsAt && row.trialEndsAt <= soonIso) {
      items.push({
        salonId: row.salonId,
        salonName: row.salonName,
        reason: "Trial por vencer",
        detail: `El trial termina el ${formatDate(row.trialEndsAt)}. Contacta al salon para cerrar la venta.`,
        severity: "warning",
      });
    }
    if (row.planId === null && row.salonIsActive) {
      items.push({
        salonId: row.salonId,
        salonName: row.salonName,
        reason: "Sin plan",
        detail: "Salon activo sin plan: ve todo sin límites.",
        severity: "warning",
      });
    }
  }

  return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short" }).format(
    new Date(`${value}T00:00:00`)
  );
}
