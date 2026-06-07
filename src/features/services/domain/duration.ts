export interface ServiceDurationParts {
  hours: number;
  minutes: number;
}

export function splitServiceDuration(totalMinutes: number): ServiceDurationParts {
  const safeTotal = Math.max(0, Math.trunc(totalMinutes));

  return {
    hours: Math.floor(safeTotal / 60),
    minutes: safeTotal % 60,
  };
}

export function combineServiceDuration({ hours, minutes }: ServiceDurationParts): number {
  return Math.trunc(hours) * 60 + Math.trunc(minutes);
}

export function isValidServiceDurationParts({ hours, minutes }: ServiceDurationParts): boolean {
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    minutes >= 0 &&
    minutes <= 59 &&
    combineServiceDuration({ hours, minutes }) >= 1
  );
}
