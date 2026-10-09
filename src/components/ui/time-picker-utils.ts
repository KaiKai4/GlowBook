export type TimePeriod = "AM" | "PM";

export interface TimeParts {
  hour: number;
  minute: number;
  period: TimePeriod;
}

export function parseTimeValue(value?: string): TimeParts {
  const [rawHour = "9", rawMinute = "0"] = (value || "09:00").split(":");
  const hour24 = Math.min(23, Math.max(0, Number(rawHour) || 0));
  const minute = Math.min(59, Math.max(0, Number(rawMinute) || 0));

  return {
    hour: hour24 % 12 || 12,
    minute,
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

export function toTimeValue({ hour, minute, period }: TimeParts): string {
  const hour24 =
    period === "AM"
      ? hour === 12
        ? 0
        : hour
      : hour === 12
        ? 12
        : hour + 12;

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatTimeValue(value?: string): string {
  const parts = parseTimeValue(value);
  const period = parts.period === "AM" ? "a. m." : "p. m.";
  return `${parts.hour}:${String(parts.minute).padStart(2, "0")} ${period}`;
}

export function isTimeWithinRange(
  value: string,
  min?: string,
  max?: string,
  maxExclusive = false
): boolean {
  if (min && value < min) return false;
  if (max && (maxExclusive ? value >= max : value > max)) return false;
  return true;
}

export function resolvePeriodForRange(
  parts: TimeParts,
  min?: string,
  max?: string,
  maxExclusive = false
): TimePeriod {
  if (!min && !max) return parts.period;

  const validPeriods = (["AM", "PM"] as TimePeriod[]).filter((period) =>
    isTimeWithinRange(
      toTimeValue({ ...parts, period }),
      min,
      max,
      maxExclusive
    )
  );

  const [onlyPeriod] = validPeriods;
  return validPeriods.length === 1 && onlyPeriod ? onlyPeriod : parts.period;
}
