import { MetricCard } from "@/components/ui/metric-card";

export function RemindersSummary({ tomorrowCount, weekCount }: { tomorrowCount: number; weekCount: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <MetricCard label="Pendientes para mañana" value={tomorrowCount} />
      <MetricCard label="Pendientes de toda la semana" value={weekCount} />
      <MetricCard label="Ventana operativa" value="Hoy a próximos 7 días" />
    </div>
  );
}
