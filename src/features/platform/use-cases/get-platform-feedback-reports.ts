import "server-only";

import { FEEDBACK_CATEGORY_LABELS, type FeedbackCategory } from "@/features/feedback";
import { findFeedbackReports } from "../data/feedback-moderation.repo";

type PlatformFeedbackCategoryVariant = "danger" | "warning" | "info" | "default";
type PlatformFeedbackStatus = "new" | "resolved";

const CATEGORY_VARIANT: Record<string, PlatformFeedbackCategoryVariant> = {
  bug: "danger",
  suggestion: "info",
  question: "warning",
  other: "default",
};

interface PlatformFeedbackReportViewModel {
  id: string;
  category: string;
  categoryLabel: string;
  categoryVariant: PlatformFeedbackCategoryVariant;
  message: string;
  status: string;
  resolved: boolean;
  toggleStatus: PlatformFeedbackStatus;
  salonName: string;
  reporterName: string;
  createdAtLabel: string;
}

export interface PlatformFeedbackReportsViewModel {
  reports: PlatformFeedbackReportViewModel[];
  visibleReports: PlatformFeedbackReportViewModel[];
  newCount: number;
  showResolved: boolean;
}

// Object.hasOwn: claves heredadas del prototipo ("toString") no son etiquetas válidas.
function categoryLabel(category: string): string {
  return Object.hasOwn(FEEDBACK_CATEGORY_LABELS, category)
    ? FEEDBACK_CATEGORY_LABELS[category as FeedbackCategory]
    : category;
}

function categoryVariant(category: string): PlatformFeedbackReportViewModel["categoryVariant"] {
  return Object.hasOwn(CATEGORY_VARIANT, category) ? (CATEGORY_VARIANT[category] ?? "default") : "default";
}

function formatCreatedAt(value: string): string {
  return new Date(value).toLocaleString("es-PA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toReportViewModel(
  report: Awaited<ReturnType<typeof findFeedbackReports>>[number]
): PlatformFeedbackReportViewModel {
  const resolved = report.status === "resolved";

  return {
    id: report.id,
    category: report.category,
    categoryLabel: categoryLabel(report.category),
    categoryVariant: categoryVariant(report.category),
    message: report.message,
    status: report.status,
    resolved,
    toggleStatus: resolved ? "new" : "resolved",
    salonName: report.salon?.name ?? "Salón eliminado",
    reporterName: report.reporter?.full_name ?? "—",
    createdAtLabel: formatCreatedAt(report.created_at),
  };
}

export async function getPlatformFeedbackReports({
  status,
}: {
  status?: string;
} = {}): Promise<PlatformFeedbackReportsViewModel> {
  const showResolved = status === "all";
  const reports = (await findFeedbackReports()).map(toReportViewModel);

  return {
    reports,
    visibleReports: showResolved
      ? reports
      : reports.filter((report) => report.status === "new"),
    newCount: reports.filter((report) => report.status === "new").length,
    showResolved,
  };
}
