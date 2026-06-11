import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";

import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import {
  getSalonActivity,
  type SalonActivityEntry,
} from "@/features/salon/use-cases/get-salon-activity";

export default async function SalonActivityPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.SALON_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para ver el log de actividad.</p>
      </div>
    );
  }

  const view = await getSalonActivity();
  const groups = groupByDate(view.entries);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/salon"
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a configuración
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-stone-900">
          <History className="h-6 w-6 text-brand-500" />
          Log de actividad
        </h1>
        <p className="mt-0.5 text-sm text-stone-400">
          Quién hizo qué en tu salón: cada creación, edición o eliminación queda registrada.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center">
          <p className="text-sm text-stone-400">
            Todavía no hay actividad registrada. Las acciones nuevas aparecerán aquí.
          </p>
        </div>
      ) : (
        groups.map(([date, entries]) => (
          <section key={date}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
              {date}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
              <div className="divide-y divide-stone-100">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-4 px-4 py-3">
                    <span className="mt-0.5 w-14 shrink-0 font-mono text-xs text-stone-400">
                      {entry.timeLabel}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-stone-800">
                        <span className="font-semibold">{entry.actionLabel}</span>
                        {entry.recordLabel ? (
                          <span className="text-stone-500"> · {entry.recordLabel}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-stone-400">{entry.actorEmail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function groupByDate(entries: SalonActivityEntry[]): Array<[string, SalonActivityEntry[]]> {
  const groups = new Map<string, SalonActivityEntry[]>();
  for (const entry of entries) {
    groups.set(entry.dateLabel, [...(groups.get(entry.dateLabel) ?? []), entry]);
  }
  return Array.from(groups.entries());
}
