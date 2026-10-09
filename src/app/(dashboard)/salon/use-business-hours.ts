"use client";

import { useState, useTransition } from "react";
import type { SalonBusinessDay as BusinessDay } from "@/features/salon/use-cases/get-salon-settings";
import { updateBusinessHoursAction } from "./actions";
import { firstHoursError } from "./salon-rules";

// Horarios de atención: edición por día, validación y guardado serializado como JSON.
export function useBusinessHours(businessHours: BusinessDay[]) {
  const [hours, setHours] = useState<BusinessDay[]>(businessHours);
  const [savedHours, setSavedHours] = useState<BusinessDay[]>(businessHours);
  const [saving, startHours] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateDay(day: number, patch: Partial<BusinessDay>) {
    setHours((prev) => prev.map((d) => (d.day_of_week === day ? { ...d, ...patch } : d)));
    setSaved(false);
    setError(null);
  }

  function saveHours() {
    setError(null);
    setSaved(false);
    const validation = firstHoursError(hours);
    if (validation) {
      setError(validation);
      return;
    }
    startHours(async () => {
      const res = await updateBusinessHoursAction(JSON.stringify(hours));
      if (res.ok) {
        setSaved(true);
        setSavedHours(hours);
      } else setError(res.error);
    });
  }

  return {
    hours,
    updateDay,
    saveHours,
    saving,
    saved,
    error,
    dirty: JSON.stringify(hours) !== JSON.stringify(savedHours),
  };
}

export type BusinessHoursState = ReturnType<typeof useBusinessHours>;
