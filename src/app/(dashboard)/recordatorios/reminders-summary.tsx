export function RemindersSummary({ tomorrowCount, weekCount }: { tomorrowCount: number; weekCount: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Pendientes para mañana
        </p>
        <p className="mt-2 text-2xl font-semibold text-brand-900">{tomorrowCount}</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Pendientes de toda la semana
        </p>
        <p className="mt-2 text-2xl font-semibold text-fg">{weekCount}</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Ventana operativa
        </p>
        <p className="mt-2 text-sm font-semibold text-fg-secondary">Hoy a próximos 7 días</p>
      </div>
    </div>
  );
}
