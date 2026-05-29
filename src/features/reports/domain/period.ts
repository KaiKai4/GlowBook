import type { ReportPreset } from "../schemas";

const DAY_MS = 86_400_000;

const WEEKDAY_TO_MONDAY_OFFSET: Record<string, number> = {
  Sun: 6,
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
};

export interface ReportDateRange {
  from: string;
  to: string;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function localDateString(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const partMap: Record<string, string> = {};
  for (const part of parts) partMap[part.type] = part.value;

  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function previousMonthRange(today: string): ReportDateRange {
  const [yearText, monthText] = today.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const lastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
  const monthPart = pad(previousMonth);

  return {
    from: `${previousYear}-${monthPart}-01`,
    to: `${previousYear}-${monthPart}-${pad(lastDay)}`,
  };
}

export function getReportPresetRange(
  preset: ReportPreset,
  timezone: string,
  now = new Date()
): ReportDateRange {
  const today = localDateString(now, timezone);

  switch (preset) {
    case "hoy":
      return { from: today, to: today };

    case "semana": {
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
      }).format(now);
      const offset = WEEKDAY_TO_MONDAY_OFFSET[weekday] ?? 0;
      const monday = new Date(now.getTime() - offset * DAY_MS);
      const sunday = new Date(monday.getTime() + 6 * DAY_MS);

      return {
        from: localDateString(monday, timezone),
        to: localDateString(sunday, timezone),
      };
    }

    case "mes": {
      const [year, month] = today.split("-");
      return { from: `${year}-${month}-01`, to: today };
    }

    case "mes_anterior":
      return previousMonthRange(today);

    case "30dias": {
      const fromDate = new Date(now.getTime() - 29 * DAY_MS);
      return { from: localDateString(fromDate, timezone), to: today };
    }

    case "90dias": {
      const fromDate = new Date(now.getTime() - 89 * DAY_MS);
      return { from: localDateString(fromDate, timezone), to: today };
    }
  }
}
