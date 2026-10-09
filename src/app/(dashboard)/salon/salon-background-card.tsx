import { Check, Palette } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import type { PanelPickerState } from "./use-panel-appearance";

const OPTION_BASE = "group flex flex-col gap-2 rounded-xl border p-3 text-left transition-all";

// Tarjeta "Fondo del panel": neutro o de color degradado.
export function SalonBackgroundCard({ bg }: { bg: PanelPickerState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-brand-500" />
          Fondo del panel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-fg-subtle mb-4">
          Elige entre un fondo neutro o un fondo de color degradado que combina con la gama seleccionada.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => bg.pick("neutral")}
            className={cn(
              OPTION_BASE,
              bg.selected === "neutral"
                ? "border-brand-400 ring-2 ring-brand-400 bg-brand-50"
                : "border-border hover:border-border-strong hover:bg-surface-muted"
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn("text-sm font-semibold", bg.selected === "neutral" ? "text-brand-700" : "text-fg-secondary")}>
                Neutro
              </span>
              {bg.selected === "neutral" && <Check className="h-4 w-4 text-brand-600" />}
            </div>
            <div className="h-14 w-full rounded-lg border border-border-subtle bg-surface-sunken flex items-center justify-center gap-2 px-2">
              <div className="h-6 w-full rounded-md bg-surface border border-border shadow-sm" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => bg.pick("colored")}
            className={cn(
              OPTION_BASE,
              bg.selected === "colored"
                ? "border-brand-400 ring-2 ring-brand-400 bg-brand-50"
                : "border-border hover:border-border-strong hover:bg-surface-muted"
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn("text-sm font-semibold", bg.selected === "colored" ? "text-brand-700" : "text-fg-secondary")}>
                De color
              </span>
              {bg.selected === "colored" && <Check className="h-4 w-4 text-brand-600" />}
            </div>
            <div
              className="h-14 w-full rounded-lg flex items-center justify-center gap-2 px-2"
              style={{
                background: "linear-gradient(150deg, var(--color-brand-300) 0%, var(--color-brand-100) 55%, var(--color-brand-200) 100%)",
              }}
            >
              <div className="h-6 w-full rounded-md bg-surface border border-surface/60 shadow-sm" />
            </div>
          </button>
        </div>

        {bg.error && (
          <p className="mt-3 rounded-lg bg-danger-subtle border border-danger-border px-3 py-2 text-sm text-danger-strong">
            {bg.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
