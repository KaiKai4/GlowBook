import { Bug, HelpCircle, Lightbulb, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from "@/features/feedback/schemas";

const CATEGORY_ICON: Record<FeedbackCategory, React.ComponentType<{ className?: string }>> = {
  bug: Bug,
  suggestion: Lightbulb,
  question: HelpCircle,
  other: MoreHorizontal,
};

export function FeedbackCategoryPicker({
  value,
  onChange,
}: {
  value: FeedbackCategory;
  onChange: (category: FeedbackCategory) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-fg-subtle">Tipo de reporte</p>
      <div className="grid grid-cols-2 gap-1.5">
        {FEEDBACK_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICON[category];
          const active = value === category;

          return (
            <button
              key={category}
              type="button"
              onClick={() => onChange(category)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                active
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-border text-fg-muted hover:bg-surface-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {FEEDBACK_CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
