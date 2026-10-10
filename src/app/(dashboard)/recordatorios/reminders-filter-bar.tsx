import { Select } from "@/components/ui/select";
import type { ReminderEmployee } from "@/features/reminders";
import type { Period } from "@/features/reminders/domain/reminder-rules";
import { parseOption } from "@/components/forms/parse-option";
import { z } from "@/infra/validation/zod";

const PERIOD_SCHEMA = z.enum(["pendientes_hoy", "manana", "48h", "7dias"]) satisfies z.ZodType<Period>;

// Etiquetas de la barra de filtros: texto de interfaz, por eso viven en la capa de app.
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "pendientes_hoy", label: "Pendientes hoy" },
  { value: "manana", label: "Mañana" },
  { value: "48h", label: "Próximos 2 días" },
  { value: "7dias", label: "Próximos 7 días" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "scheduled", label: "Agendada" },
  { value: "confirmed", label: "Confirmada" },
];

interface RemindersFilterBarProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
  empId: string;
  onEmpIdChange: (empId: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  employees: ReminderEmployee[];
}

export function RemindersFilterBar({
  period,
  onPeriodChange,
  empId,
  onEmpIdChange,
  status,
  onStatusChange,
  employees,
}: RemindersFilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface px-5 py-4 shadow-soft">
      <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <Select label="Vista" value={period} onChange={(event) => onPeriodChange(parseOption(PERIOD_SCHEMA, event.target.value, period))}>
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </div>

      <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
        <Select
          label="Profesional"
          placeholder="Todos los colaboradores"
          value={empId}
          onChange={(event) => onEmpIdChange(event.target.value)}
        >
          <option value="">Todos los colaboradores</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.name}</option>
          ))}
        </Select>
      </div>

      <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <Select
          label="Estado"
          placeholder="Todos los estados"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}
