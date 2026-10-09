"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import type { SalonWindow } from "../../new/appointment-wizard-types";

export interface AppointmentEditScheduleCardProps {
  date: string;
  time: string;
  selectedWindow: SalonWindow | null;
  isClosedDay: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}

/** Tarjeta de fecha y hora de la cita, con el horario del salón para el día elegido. */
export function AppointmentEditScheduleCard({
  date,
  time,
  selectedWindow,
  isClosedDay,
  onDateChange,
  onTimeChange,
}: AppointmentEditScheduleCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Horario</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <DatePicker label="Fecha" value={date} onChange={onDateChange} required />
        <TimePicker
          label="Hora"
          value={time}
          onChange={onTimeChange}
          min={selectedWindow?.open ?? "06:00"}
          max={selectedWindow?.close ?? "21:30"}
          maxExclusive
          required
        />
        {isClosedDay && (
          <p className="sm:col-span-2 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
            El salón está cerrado ese día.
          </p>
        )}
        {selectedWindow && (
          <p className="sm:col-span-2 text-xs text-fg-subtle">
            Horario del salón: {selectedWindow.open} - {selectedWindow.close}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
