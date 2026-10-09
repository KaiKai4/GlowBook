import Link from "next/link";
import { Building2, Check, Clock, MessageSquareWarning, RotateCcw, User } from "lucide-react";
import { getPlatformFeedbackReports } from "@/features/platform/use-cases/get-platform-feedback-reports";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { setFeedbackStatusAction } from "./actions";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePlatformAdmin();
  const { status } = await searchParams;
  const view = await getPlatformFeedbackReports({ status });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-fg flex items-center gap-2">
            <MessageSquareWarning className="h-6 w-6 text-accent" />
            Reportes
          </h1>
          <p className="text-sm text-fg-subtle mt-0.5">
            Fallas, caídas y sugerencias enviadas por los salones.
            {view.newCount > 0 && (
              <span className="ml-1 font-semibold text-accent">
                {view.newCount} sin revisar
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-border bg-surface-muted p-0.5 text-sm">
          <Link
            href="/admin/reports"
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              !view.showResolved
                ? "bg-surface text-fg shadow-sm"
                : "text-fg-subtle hover:text-fg-secondary"
            }`}
          >
            Sin revisar
          </Link>
          <Link
            href="/admin/reports?status=all"
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              view.showResolved
                ? "bg-surface text-fg shadow-sm"
                : "text-fg-subtle hover:text-fg-secondary"
            }`}
          >
            Todas
          </Link>
        </div>
      </div>

      {view.visibleReports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface py-16 text-center">
          <p className="text-sm text-fg-subtle">
            {view.showResolved ? "No hay reportes todavía." : "No hay reportes sin revisar."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {view.visibleReports.map((report) => (
            <div
              key={report.id}
              className={`rounded-xl border bg-surface p-4 shadow-sm ${
                report.resolved ? "border-border opacity-75" : "border-accent-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={report.categoryVariant}>{report.categoryLabel}</Badge>
                  <span className="flex items-center gap-1 text-xs text-fg-subtle">
                    <Building2 className="h-3.5 w-3.5" />
                    {report.salonName}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-fg-subtle">
                    <User className="h-3.5 w-3.5" />
                    {report.reporterName}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-fg-subtle">
                    <Clock className="h-3.5 w-3.5" />
                    {report.createdAtLabel}
                  </span>
                </div>

                <form action={setFeedbackStatusAction}>
                  <input type="hidden" name="id" value={report.id} />
                  <input type="hidden" name="status" value={report.toggleStatus} />
                  <button
                    type="submit"
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      report.resolved
                        ? "border-border text-fg-subtle hover:bg-surface-muted"
                        : "border-success-border bg-success-subtle text-success-fg hover:bg-success-subtle"
                    }`}
                  >
                    {report.resolved ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" /> Marcar resuelto
                      </>
                    )}
                  </button>
                </form>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm text-fg-secondary">{report.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
