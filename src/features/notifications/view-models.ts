export interface ReminderAppointment {
  id: string;
  status: string;
  start_time: string | null;
  total_price: number | string | null;
  customer: {
    first_name: string;
    last_name: string;
    phone: string | null;
  } | null;
  items: Array<{
    id: string;
    service: { name: string } | null;
    employee: { id: string; first_name: string; last_name: string } | null;
  }>;
}

export interface ReminderEmployee {
  id: string;
  name: string;
}

export interface ReminderQueueViewModel {
  appointments: ReminderAppointment[];
  employees: ReminderEmployee[];
  timezone: string;
  salonName: string;
  template: string;
}
