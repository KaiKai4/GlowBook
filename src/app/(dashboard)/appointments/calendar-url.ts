import type { CalendarView } from "@/features/appointments/view-models";

export function buildAppointmentsHref({
  date,
  view,
}: {
  date: string;
  view: CalendarView;
}): string {
  const params = new URLSearchParams();
  params.set("date", date);
  params.set("view", view);
  return `/appointments?${params.toString()}`;
}
