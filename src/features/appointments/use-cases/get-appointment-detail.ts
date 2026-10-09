import "server-only";

import { getSalonIdentity } from "@/features/salon";
import { findAppointmentById } from "../data/appointments.repo";

type AppointmentStatusVariant =
  | "default"
  | "info"
  | "success"
  | "danger"
  | "warning"
  | "primary";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const STATUS_VARIANT: Record<string, AppointmentStatusVariant> = {
  scheduled: "info",
  confirmed: "primary",
  completed: "success",
  cancelled: "danger",
  no_show: "warning",
};

interface AppointmentDetailItemViewModel {
  id: string;
  serviceId: string;
  employeeId: string;
  serviceName: string;
  serviceCategoryName: string;
  pricingMode: "fixed" | "variable";
  employeeName: string;
  start_time: string;
  end_time: string;
  price: number;
  discountAmount: number;
}

export interface AppointmentDetailViewModel {
  id: string;
  status: string;
  statusLabel: string;
  statusVariant: AppointmentStatusVariant;
  customerName: string;
  customer: {
    first_name: string;
    last_name: string;
  } | null;
  start_time: string | null;
  end_time: string | null;
  subtotal_price: number;
  discount_amount: number;
  total_price: number;
  completion_price_note: string | null;
  notes: string | null;
  timezone: string;
  items: AppointmentDetailItemViewModel[];
}

export interface GetAppointmentDetailInput {
  appointmentId: string;
  salonId: string;
}

export async function getAppointmentDetail({
  appointmentId,
  salonId,
}: GetAppointmentDetailInput): Promise<AppointmentDetailViewModel | null> {
  const appointment = await findAppointmentById(appointmentId, salonId);
  if (!appointment || appointment.salon_id !== salonId) return null;

  const salon = await getSalonIdentity(salonId);

  return {
    id: appointment.id,
    status: appointment.status,
    statusLabel: STATUS_LABEL[appointment.status] ?? appointment.status,
    statusVariant: STATUS_VARIANT[appointment.status] ?? "default",
    customerName: appointment.customer
      ? `${appointment.customer.first_name} ${appointment.customer.last_name}`.trim()
      : "Cliente sin nombre",
    customer: appointment.customer
      ? {
          first_name: appointment.customer.first_name,
          last_name: appointment.customer.last_name,
        }
      : null,
    start_time: appointment.start_time,
    end_time: appointment.end_time,
    subtotal_price: appointment.items.reduce((sum, item) => sum + Number(item.price ?? 0), 0),
    discount_amount: Number(appointment.discount_amount ?? 0),
    total_price: Number(appointment.total_price ?? 0),
    completion_price_note: appointment.completion_price_note || null,
    notes: appointment.notes,
    timezone: salon?.timezone ?? "America/Panama",
    items: appointment.items.map((item) => ({
      id: item.id,
      serviceId: item.service_id,
      employeeId: item.employee_id,
      serviceName: item.service?.name ?? "Servicio eliminado",
      serviceCategoryName: item.service?.category?.name ?? "Sin categoria",
      pricingMode: item.service?.category?.pricing_mode === "variable" ? "variable" : "fixed",
      employeeName: item.employee
        ? `${item.employee.first_name} ${item.employee.last_name}`.trim()
        : "Colaborador no asignado",
      start_time: item.start_time,
      end_time: item.end_time,
      price: Number(item.price ?? 0),
      discountAmount: Number(item.discount_amount ?? 0),
    })),
  };
}
