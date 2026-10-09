import { cn } from "@/components/ui/cn";
import type { Category } from "./services-types";

function CategoryRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
          active ? "bg-accent-subtle font-medium text-accent-strong" : "text-fg-muted hover:bg-surface-muted"
        )}
      >
        <span className="flex items-center gap-2">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-accent" : "bg-border-strong")}
          />
          {label}
        </span>
        <span className="text-xs text-fg-subtle">{count}</span>
      </button>
    </li>
  );
}

export function ServicesSidebar({
  categories,
  activeCategoryId,
  totalServices,
  onSelectCategory,
  onCreateCategory,
}: {
  categories: Category[];
  activeCategoryId: string;
  totalServices: number;
  onSelectCategory: (categoryId: string) => void;
  onCreateCategory: () => void;
}) {
  return (
    <aside>
      <div className="rounded-xl border border-border-subtle bg-surface p-2">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Categorías
          </span>
          <button
            onClick={onCreateCategory}
            className="text-xs font-medium text-accent-strong hover:text-accent-strong"
          >
            + Nueva
          </button>
        </div>
        <ul className="mt-1 space-y-0.5">
          <CategoryRow
            label="Todas"
            count={totalServices}
            active={activeCategoryId === "all"}
            onClick={() => onSelectCategory("all")}
          />
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              label={category.name}
              count={category.services.length}
              active={activeCategoryId === category.id}
              onClick={() => onSelectCategory(category.id)}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}
