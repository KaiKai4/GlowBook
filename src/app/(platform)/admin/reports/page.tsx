import { requirePlatformAdmin } from "@/lib/auth/session";
import { findFeedbackReports } from "@/features/platform/data/platform.repo";
import { FEEDBACK_CATEGORY_LABELS, type FeedbackCategory } from "@/features/feedback/schemas";
import { Badge } from "@/components/ui/badge";
import { setFeedbackStatusAction } from "./actions";
import { MessageSquareWarning, Check, RotateCcw, Building2, User, Clock } from "lucide-react";
import Link from "next/link";

const CATEGORY_VARIANT: Record<string, "danger" | "warning" | "info" | "default"> = {
  bug: "danger",
  suggestion: "info",
  question: "warning",
  other: "default",
};

function categoryLabel(c: string): string {
  return FEEDBACK_CATEGORY_LABELS[c as FeedbackCategory] ?? c;
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePlatformAdmin();
  const { status } = await searchParams;
  const showResolved = status === "all";

  const reports = await findFeedbackReports();
  const newCount = reports.filter((r) => r.status === "new").length;
  const visible = showResolved ? reports : reports.filter((r) => r.status === "new");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <MessageSquareWarning className="h-6 w-6 text-rose-500" />
            Reportes
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Fallas, caídas y sugerencias enviadas por los salones.
            {newCount > 0 && <span className="ml-1 font-semibold text-rose-600">{newCount} sin revisar</span>}
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 text-sm">
          <Link
            href="/admin/reports"
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${!showResolved ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
          >
            Sin revisar
          </Link>
          <Link
            href="/admin/reports?status=all"
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${showResolved ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
          >
            Todas
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center">
          <p className="text-sm text-neutral-400">
            {showResolved ? "No hay reportes todavía." : "No hay reportes sin revisar. 🎉"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const resolved = r.status === "resolved";
            return (
              <div
                key={r.id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${resolved ? "border-neutral-200 opacity-75" : "border-rose-100"}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={CATEGORY_VARIANT[r.category] ?? "default"}>{categoryLabel(r.category)}</Badge>
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Building2 className="h-3.5 w-3.5" />
                      {r.salon?.name ?? "Salón eliminado"}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                      <User className="h-3.5 w-3.5" />
                      {r.reporter?.full_name ?? "—"}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(r.created_at).toLocaleString("es-PA", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <form action={setFeedbackStatusAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value={resolved ? "new" : "resolved"} />
                    <button
                      type="submit"
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        resolved
                          ? "border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {resolved ? <><RotateCcw className="h-3.5 w-3.5" /> Reabrir</> : <><Check className="h-3.5 w-3.5" /> Marcar resuelto</>}
                    </button>
                  </form>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{r.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
