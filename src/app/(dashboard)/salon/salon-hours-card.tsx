import { Check, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils/cn";
import type { SalonBusinessDay as BusinessDay } from "@/features/salon/use-cases/get-salon-settings";
import { DAY_LABELS } from "./salon-rules";
import type { BusinessHoursState } from "./use-business-hours";

function DayHours({ day, onUpdate }: { day: BusinessDay; onUpdate: BusinessHoursState["updateDay"] }) {
  const dayLabel = DAY_LABELS[day.day_of_week];
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <div className="w-28 shrink-0">
        <p className="text-sm font-semibold text-fg-secondary">{dayLabel}</p>
      </div>

      <button
        type="button"
        onClick={() => onUpdate(day.day_of_week, { is_open: !day.is_open })}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors shrink-0",
          day.is_open
            ? "border-brand-400 bg-brand-50 text-brand-700"
            : "border-border bg-surface-muted text-fg-subtle hover:border-border-strong"
        )}
      >
        {day.is_open ? "Abierto" : "Cerrado"}
      </button>

      {day.is_open ? (
        <div className="flex items-center gap-2">
          <TimePicker
            value={day.open_time}
            compact
            ariaLabel={`Hora de apertura del ${dayLabel}`}
            onChange={(open_time) => onUpdate(day.day_of_week, { open_time })}
          />
          <span className="text-fg-subtle text-sm">a</span>
          <TimePicker
            value={day.close_time}
            compact
            ariaLabel={`Hora de cierre del ${dayLabel}`}
            onChange={(close_time) => onUpdate(day.day_of_week, { close_time })}
          />
        </div>
      ) : (
        <span className="text-sm text-fg-subtle">Sin atención este día</span>
      )}
    </div>
  );
}

// Tarjeta "Días y horarios de atención": apertura por día y guardado de horarios.
export function SalonHoursCard({ timezone, hours }: { timezone: string; hours: BusinessHoursState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-500" />
          Días y horarios de atención
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-xs text-fg-subtle mb-3">
          Estos horarios definen cuándo se pueden agendar citas. Zona horaria: {timezone}
        </p>

        <div className="divide-y divide-border-subtle">
          {hours.hours.map((day) => (
            <DayHours key={day.day_of_week} day={day} onUpdate={hours.updateDay} />
          ))}
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button variant="primary" onClick={hours.saveHours} loading={hours.saving}>
            Guardar horarios
          </Button>
          {hours.saved && (
            <span className="flex items-center gap-1 text-sm text-success-fg">
              <Check className="h-4 w-4" /> Horarios actualizados
            </span>
          )}
        </div>
        {hours.error && (
          <p className="mt-2 rounded-lg bg-danger-subtle border border-danger-border px-3 py-2 text-sm text-danger-strong">
            {hours.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
