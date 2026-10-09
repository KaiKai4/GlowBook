import type { CalendarAppointment, CalendarEmployee } from "@/features/appointments/view-models";
import {
  matchesSummaryFilter,
  type SummaryFilter,
} from "@/features/appointments/domain/summary-filter";

export function filterEmployeesByName(
  employees: CalendarEmployee[],
  query: string
): CalendarEmployee[] {
  if (!query) return employees;
  const q = query.toLowerCase();
  return employees.filter((e) => `${e.first_name} ${e.last_name}`.toLowerCase().includes(q));
}

export function filterAppointmentsByEmployee(
  appointments: CalendarAppointment[],
  employeeId: string
): CalendarAppointment[] {
  return appointments.filter((a) => a.items.some((it) => it.employee?.id === employeeId));
}

function appointmentTimeValue(appt: CalendarAppointment): number {
  return appt.start_time ? new Date(appt.start_time).getTime() : Number.MAX_SAFE_INTEGER;
}

// Resumen: citas que cumplen el filtro, ordenadas por hora y, en empate, por id.
export function summaryAppointments(
  appointments: CalendarAppointment[],
  filter: SummaryFilter
): CalendarAppointment[] {
  return appointments
    .filter((appointment) => matchesSummaryFilter(appointment.status, filter))
    .sort((a, b) => {
      const timeDiff = appointmentTimeValue(a) - appointmentTimeValue(b);
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });
}
