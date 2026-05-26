"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const options = [];
  for (let hour = 6; hour <= 21; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === 21 && minute > 30) break;
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const suffix = hour >= 12 ? "p.m." : "a.m.";
      options.push({
        value,
        label: `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`,
      });
    }
  }
  return options;
})();

export function TimePicker({
  label,
  value,
  onChange,
  minTime,
  maxTime,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minTime?: string;
  maxTime?: string;
}) {
  const options = useMemo(() => {
    const filtered = TIME_OPTIONS.filter(
      (option) =>
        (!minTime || option.value >= minTime) &&
        (!maxTime || option.value < maxTime)
    );
    return filtered.length > 0 ? filtered : TIME_OPTIONS;
  }, [minTime, maxTime]);

  const snapped = useMemo(() => {
    if (options.some((option) => option.value === value)) return value;

    const [hour, minute] = value.split(":").map(Number);
    const currentMinutes = hour * 60 + minute;
    let nearest = options[0].value;
    let nearestDiff = Infinity;

    for (const option of options) {
      const [optionHour, optionMinute] = option.value.split(":").map(Number);
      const diff = Math.abs(optionHour * 60 + optionMinute - currentMinutes);
      if (diff < nearestDiff) {
        nearest = option.value;
        nearestDiff = diff;
      }
    }

    return nearest;
  }, [value, options]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-stone-700">{label}</label>
      <div className="relative">
        <select
          value={snapped}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow cursor-pointer"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Clock className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
      </div>
    </div>
  );
}
