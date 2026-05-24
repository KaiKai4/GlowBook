"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { Settings, Clock, Check, Store } from "lucide-react";
import { updateSalonInfoAction, updateBusinessHoursAction } from "./actions";
import type { BusinessDay } from "./page";

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function SalonSettings({
  salonName,
  timezone,
  businessHours,
}: {
  salonName: string;
  timezone: string;
  businessHours: BusinessDay[];
}) {
  // ── Salon name ──────────────────────────────────────────────────
  const [savingName, startName] = useTransition();
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  function saveName(formData: FormData) {
    setNameError(null);
    setNameSaved(false);
    startName(async () => {
      const res = await updateSalonInfoAction(null, formData);
      if (res.ok) setNameSaved(true);
      else setNameError(res.error);
    });
  }

  // ── Business hours ──────────────────────────────────────────────
  const [hours, setHours] = useState<BusinessDay[]>(businessHours);
  const [savingHours, startHours] = useTransition();
  const [hoursSaved, setHoursSaved] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);

  function updateDay(day: number, patch: Partial<BusinessDay>) {
    setHours((prev) => prev.map((d) => (d.day_of_week === day ? { ...d, ...patch } : d)));
    setHoursSaved(false);
    setHoursError(null);
  }

  function saveHours() {
    setHoursError(null);
    setHoursSaved(false);
    for (const d of hours) {
      if (d.is_open && !(d.open_time < d.close_time)) {
        setHoursError(`${DAY_LABELS[d.day_of_week]}: la hora de cierre debe ser mayor que la de apertura.`);
        return;
      }
    }
    startHours(async () => {
      const res = await updateBusinessHoursAction(JSON.stringify(hours));
      if (res.ok) setHoursSaved(true);
      else setHoursError(res.error);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-violet-500" />
          Configuración del salón
        </h1>
        <p className="text-sm text-stone-400 mt-0.5">
          Edita el nombre y los días y horarios de atención.
        </p>
      </div>

      {/* ── General info ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-4 w-4 text-violet-500" />
            Información general
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveName} className="space-y-4">
            <Input
              name="name"
              label="Nombre del salón"
              defaultValue={salonName}
              required
              maxLength={120}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" loading={savingName}>
                Guardar nombre
              </Button>
              {nameSaved && (
                <span className="flex items-center gap-1 text-sm text-emerald-600">
                  <Check className="h-4 w-4" /> Guardado
                </span>
              )}
            </div>
            {nameError && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {nameError}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ── Business hours ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-violet-500" />
            Días y horarios de atención
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-xs text-stone-400 mb-3">
            Estos horarios definen cuándo se pueden agendar citas. Zona horaria: {timezone}
          </p>

          <div className="divide-y divide-stone-100">
            {hours.map((day) => (
              <div key={day.day_of_week} className="flex flex-wrap items-center gap-3 py-3">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-semibold text-stone-800">{DAY_LABELS[day.day_of_week]}</p>
                </div>

                <button
                  type="button"
                  onClick={() => updateDay(day.day_of_week, { is_open: !day.is_open })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors shrink-0",
                    day.is_open
                      ? "border-violet-400 bg-violet-50 text-violet-700"
                      : "border-stone-200 bg-stone-50 text-stone-400 hover:border-stone-300"
                  )}
                >
                  {day.is_open ? "Abierto" : "Cerrado"}
                </button>

                {day.is_open ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={day.open_time}
                      step={1800}
                      onChange={(e) => updateDay(day.day_of_week, { open_time: e.target.value })}
                      className="h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    <span className="text-stone-400 text-sm">a</span>
                    <input
                      type="time"
                      value={day.close_time}
                      step={1800}
                      onChange={(e) => updateDay(day.day_of_week, { close_time: e.target.value })}
                      className="h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-stone-400">Sin atención este día</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button variant="primary" onClick={saveHours} loading={savingHours}>
              Guardar horarios
            </Button>
            {hoursSaved && (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <Check className="h-4 w-4" /> Horarios actualizados
              </span>
            )}
          </div>
          {hoursError && (
            <p className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {hoursError}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
