import "server-only";

import { findAppointmentsBySalon } from "../data/appointments.repo";
import { getEmployeeCalendarOptions } from "@/features/employees/use-cases/employee-calendar-options";
import { getActiveMessageTemplate } from "@/features/notifications/use-cases/active-message-template";
import { getSalonBusinessHours } from "@/features/salon/use-cases/salon-business-hours";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { getSalonPaymentMethods } from "@/features/salon/use-cases/salon-payment-methods";
import { formatLocalDateISO, utcBounds } from "@/infra/format/dates";
import {
  countActiveCalendarAppointments,
  formatCalendarDateLabel,
  getBusinessHourRange,
  getVisibleWeekDates,
  getWeekDates,
  parseCalendarView,
} from "../domain/calendar";
import type { CalendarAppointment, CalendarView, CalendarViewModel } from "../view-models";
import { isPricingMode } from "../domain/pricing";
import type { AppointmentStatus } from "../domain/lifecycle";

export interface GetCalendarViewInput {
  salonId: string;
  canViewAll: boolean;
  date?: string;
  view?: string;
  now?: Date;
}

function normalizeView(requestedView: string | undefined, canViewAll: boolean): CalendarView {
  const view = parseCalendarView(requestedView);
  return !canViewAll && view === "trabajador" ? "semanal" : view;
}

function toAppointmentStatus(status: string): AppointmentStatus {
  if (
    status === "scheduled" ||
    status === "confirmed" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "no_show"
  ) {
    return status;
  }

  return "scheduled";
}

function toCalendarAppointment(appointment: Awaited<ReturnType<typeof findAppointmentsBySalon>>[number]): CalendarAppointment {
  return {
    id: appointment.id,
    status: toAppointmentStatus(appointment.status),
    start_time: appointment.start_time,
    end_time: appointment.end_time,
    total_price: appointment.total_price,
    discount_amount: appointment.discount_amount,
    completion_price_note: appointment.completion_price_note,
    notes: appointment.notes,
    customer: appointment.customer,
    items: appointment.items.map((item) => ({
      id: item.id,
      start_time: item.start_time,
      end_time: item.end_time,
      price: item.price,
      discount_amount: Number(item.discount_amount ?? 0),
      service: item.service
        ? {
            ...item.service,
            category: item.service.category
              ? {
                  ...item.service.category,
                  pricing_mode: isPricingMode(item.service.category.pricing_mode)
                    ? item.service.category.pricing_mode
                    : "fixed",
                }
              : null,
          }
        : null,
      employee: item.employee,
    })),
  };
}

export async function getCalendarView({
  salonId,
  canViewAll,
  date,
  view: requestedView,
  now = new Date(),
}: GetCalendarViewInput): Promise<CalendarViewModel> {
  const salon = await getSalonIdentity(salonId);
  const timezone = salon?.timezone ?? "America/Panama";
  const selectedDate = date ?? formatLocalDateISO(now, timezone);
  const view = normalizeView(requestedView, canViewAll);

  const [employees, businessHours, cancellationTemplate, paymentMethods] = await Promise.all([
    canViewAll ? getEmployeeCalendarOptions(salonId) : Promise.resolve([]),
    getSalonBusinessHours(salonId),
    getActiveMessageTemplate(salonId, "appointment_cancelled"),
    getSalonPaymentMethods(salonId),
  ]);

  const weekDates = getWeekDates(selectedDate);
  const visibleWeekDates = getVisibleWeekDates(selectedDate, businessHours);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  if (!weekStart || !weekEnd) throw new Error("Invariante de calendario: la semana tiene 7 días.");
  const startDate = view === "semanal" ? weekStart : selectedDate;
  const endDate = view === "semanal" ? weekEnd : selectedDate;
  const { start, end } = utcBounds(startDate, endDate, timezone);
  const appointments = (await findAppointmentsBySalon(salonId, {
    startDate: start,
    endDate: end,
  })).map(toCalendarAppointment);
  const { businessStart, businessEnd } = getBusinessHourRange(businessHours);

  return {
    date: selectedDate,
    view,
    showWorkerView: canViewAll,
    dateLabel: formatCalendarDateLabel(selectedDate, view, visibleWeekDates, weekDates),
    activeCount: countActiveCalendarAppointments(
      appointments,
      view,
      visibleWeekDates,
      timezone
    ),
    appointments,
    timezone,
    employees,
    visibleWeekDates,
    businessStart,
    businessEnd,
    salonName: salon?.name ?? "tu salon",
    cancellationTemplate: cancellationTemplate.bodyText,
    paymentMethodOptions: paymentMethods.options,
  };
}
