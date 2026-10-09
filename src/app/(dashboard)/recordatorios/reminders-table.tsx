import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { ReminderAppointment } from "@/features/reminders/view-models";
import {
  ReminderCustomerCell,
  ReminderDateCell,
  ReminderEmployeesCell,
  ReminderServicesCell,
  ReminderStatusCell,
} from "./reminder-cells";
import { ReminderRowActions } from "./reminder-row-actions";
import { toReminderTableRows, type ReminderTableRow } from "./reminders-table-rows";
import type { ReminderActions } from "./use-reminder-actions";

interface RemindersTableProps {
  rows: ReminderAppointment[];
  tz: string;
  today: string;
  actions: ReminderActions;
}

function buildColumns(tz: string, actions: ReminderActions): DataTableColumn<ReminderTableRow>[] {
  return [
    { id: "customer", header: "Cliente", cell: ({ appt }) => <ReminderCustomerCell appt={appt} /> },
    {
      id: "employees",
      header: "Profesional",
      secondary: true,
      cell: ({ appt }) => <ReminderEmployeesCell appt={appt} />,
    },
    {
      id: "services",
      header: "Servicios",
      secondary: true,
      cell: ({ appt }) => <ReminderServicesCell appt={appt} />,
    },
    { id: "date", header: "Fecha", cell: ({ appt }) => <ReminderDateCell appt={appt} tz={tz} /> },
    { id: "status", header: "Recordatorio", cell: ({ state }) => <ReminderStatusCell state={state} tz={tz} /> },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ appt, state, sendBusy, confirmBusy }) => (
        <ReminderRowActions
          appt={appt}
          actions={actions}
          row={state}
          sendBusy={sendBusy}
          confirmBusy={confirmBusy}
        />
      ),
    },
  ];
}

// Tabla de recordatorios: una fila por cita filtrada, con estado del recordatorio y acciones.
export function RemindersTable({ rows, tz, today, actions }: RemindersTableProps) {
  const tableRows = toReminderTableRows(rows, actions, actions, today, tz);

  return (
    <DataTable
      label="Citas con recordatorio"
      columns={buildColumns(tz, actions)}
      rows={tableRows}
      getRowId={(row) => row.appt.id}
      emptyMessage="Sin citas para estos filtros."
    />
  );
}
