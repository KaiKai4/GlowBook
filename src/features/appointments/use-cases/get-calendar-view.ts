import "server-only";

import { findAppointmentsBySalon } from "../data/appointments.repo";
import { findActiveEmployeeNames } from "@/features/employees/data/employees.repo";
import { findActiveMessageTemplate } from "@/features/notifications/data/notification-templates.repo";
import { findBusinessHours, findSalonIdentity } from "@/features/salon/data/salon.repo";
import { formatLocalDateISO, utcBounds } from "@/lib/utils/dates";
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

function toCalendarAppointment(appointment: Awaited<ReturnType<typeof findAppointmentsBySalon>>[number]): CalendarAppointment {
  return {
    id: appointment.id,
    status: appointment.status,
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
  const salon = await findSalonIdentity(salonId);
  const timezone = salon?.timezone ?? "America/Panama";
  const selectedDate = date ?? formatLocalDateISO(now, timezone);
  const view = normalizeView(requestedView, canViewAll);

  const [employees, businessHours, cancellationTemplate] = await Promise.all([
    canViewAll ? findActiveEmployeeNames(salonId) : Promise.resolve([]),
    findBusinessHours(salonId),
    findActiveMessageTemplate(salonId, "appointment_cancelled"),
  ]);

  const weekDates = getWeekDates(selectedDate);
  const visibleWeekDates = getVisibleWeekDates(selectedDate, businessHours);
  const startDate = view === "semanal" ? weekDates[0] : selectedDate;
  const endDate = view === "semanal" ? weekDates[6] : selectedDate;
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
    cancellationTemplate: cancellationTemplate.body_text,
  };
}
