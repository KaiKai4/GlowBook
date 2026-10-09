import { Select } from "@/components/ui/select";
import type { ReminderEmployee } from "@/features/reminders/view-models";
import { PERIOD_OPTIONS, STATUS_OPTIONS, type Period } from "./reminder-rules";

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
        <Select label="Vista" value={period} onChange={(event) => onPeriodChange(event.target.value as Period)}>
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
