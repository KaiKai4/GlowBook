import { Check, Palette } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import type { PanelPickerState } from "./use-panel-appearance";

// Paletas de la gama. Cada muestra usa los tokens brand-* del [data-theme] de su clave (ver globals.css).
const THEMES: { key: string; label: string }[] = [
  { key: "violet", label: "Violeta" },
  { key: "mocco", label: "Mocco" },
  { key: "tiffany", label: "Tiffany Blue" },
  { key: "viridian", label: "Viridian" },
  { key: "yellow", label: "Yellow" },
  { key: "rosewater", label: "Rosewater" },
];

const SWATCH_CLASSES = ["bg-brand-100", "bg-brand-400", "bg-brand-600", "bg-brand-900"];

// Tarjeta "Gama de colores": elige la paleta de acento del panel.
export function SalonThemeCard({ theme }: { theme: PanelPickerState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-brand-500" />
          Gama de colores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-fg-subtle mb-4">
          Cambia el color de botones, líneas y acentos del panel. El fondo se mantiene blanco.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {THEMES.map((t) => {
            const active = theme.selected === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => theme.pick(t.key)}
                className={cn(
                  "group flex flex-col gap-2 rounded-xl border p-3 text-left transition-all",
                  active
                    ? "border-brand-400 ring-2 ring-brand-400 bg-brand-50"
                    : "border-border hover:border-border-strong hover:bg-surface-muted"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm font-semibold", active ? "text-brand-700" : "text-fg-secondary")}>
                    {t.label}
                  </span>
                  {active && <Check className="h-4 w-4 text-brand-600" />}
                </div>
                <div className="flex gap-1" data-theme={t.key} data-theme-preview>
                  {SWATCH_CLASSES.map((swatchClass) => (
                    <span
                      key={swatchClass}
                      className={cn("h-6 flex-1 rounded-md border border-border-subtle", swatchClass)}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {theme.error && (
          <p className="mt-3 rounded-lg bg-danger-subtle border border-danger-border px-3 py-2 text-sm text-danger-strong">
            {theme.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
