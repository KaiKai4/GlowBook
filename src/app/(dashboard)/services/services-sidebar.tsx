import { cn } from "@/lib/utils/cn";
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
          active ? "bg-rose-50 font-medium text-rose-700" : "text-neutral-600 hover:bg-neutral-50"
        )}
      >
        <span className="flex items-center gap-2">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-rose-500" : "bg-neutral-300")}
          />
          {label}
        </span>
        <span className="text-xs text-neutral-400">{count}</span>
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
      <div className="rounded-xl border border-neutral-100 bg-white p-2">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Categorías
          </span>
          <button
            onClick={onCreateCategory}
            className="text-xs font-medium text-rose-600 hover:text-rose-700"
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
