"use client";

import { useState, useTransition } from "react";
import { getOccupiedSlotsForDate } from "../actions";
import { salonWindowFor } from "@/features/appointments/domain/wizard-availability";
import type { BusinessHour, SalonConfig } from "@/features/appointments/domain/types";
import type { OccupiedByEmployee } from "./appointment-wizard-types";

/** Fecha y hora de la cita y la carga de la agenda ocupada de ese día. */
export function useAvailability({
  timezone,
  businessHours,
}: {
  timezone: SalonConfig["timezone"];
  businessHours: BusinessHour[];
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [occupied, setOccupied] = useState<OccupiedByEmployee>({});
  const [loadingAvailability, startAvailability] = useTransition();

  // Al cambiar de fecha, la hora se ajusta a la apertura si cae fuera del horario.
  function loadAvailability(nextDate: string) {
    if (!nextDate) return;

    const windowForDate = salonWindowFor(nextDate, timezone, businessHours);
    if (windowForDate && (time < windowForDate.open || time >= windowForDate.close)) {
      setTime(windowForDate.open);
    }

    startAvailability(async () => {
      const slots = await getOccupiedSlotsForDate(nextDate);
      setOccupied(slots);
    });
  }

  return { date, setDate, time, setTime, occupied, loadingAvailability, loadAvailability };
}
