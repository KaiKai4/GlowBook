"use client";

import { Select } from "@/components/ui/select";
import { formatTimeTz } from "@/infra/format/dates";
import { cn } from "@/components/ui/cn";
import { GripVertical, Trash2 } from "lucide-react";
import type {
  AppointmentScheduleItem,
  AppointmentServiceRow as ServiceRow,
  CategoryOption,
  EmployeeOption,
  ServiceOption,
} from "./appointment-wizard-types";

export interface AppointmentServiceRowProps {
  item: AppointmentScheduleItem;
  index: number;
  rowsCount: number;
  categories: CategoryOption[];
  services: ServiceOption[];
  timezone: string;
  dragIndex: number | null;
  setDragIndex: (index: number | null) => void;
  getEligibleEmployees: (
    serviceId: string,
    start: Date | null,
    end: Date | null
  ) => EmployeeOption[];
  updateRow: (key: string, patch: Partial<ServiceRow>) => void;
  removeRow: (key: string) => void;
  reorder: (from: number, to: number) => void;
}

/** Tarjeta de un servicio de la cita: categoría, servicio y profesional, arrastrable. */
export function AppointmentServiceRow({
  item,
  index,
  rowsCount,
  categories,
  services,
  timezone,
  dragIndex,
  setDragIndex,
  getEligibleEmployees,
  updateRow,
  removeRow,
  reorder,
}: AppointmentServiceRowProps) {
  const filteredServices = item.row.categoryId
    ? services.filter((service) => service.category_id === item.row.categoryId)
    : [];
  const eligibleEmployees = item.row.serviceId
    ? getEligibleEmployees(item.row.serviceId, item.start, item.end)
    : [];
  const selectedStillEligible =
    !item.row.employeeId ||
    eligibleEmployees.some((employee) => employee.id === item.row.employeeId);

  return (
    <div
      draggable
      onDragStart={() => setDragIndex(index)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => {
        if (dragIndex !== null) reorder(dragIndex, index);
        setDragIndex(null);
      }}
      className={cn(
        "rounded-xl border bg-surface p-4 transition-all",
        dragIndex === index
          ? "border-brand-400 shadow-focus"
          : "border-brand-100 shadow-hairline"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="cursor-grab text-fg-disabled hover:text-fg-subtle transition-colors">
            <GripVertical className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-fg-secondary">
            Servicio {index + 1}
          </span>
          {item.start && (
            <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
              {formatTimeTz(item.start, timezone)}
              {item.end && ` - ${formatTimeTz(item.end, timezone)}`}
            </span>
          )}
        </div>
        {rowsCount > 1 && (
          <button
            type="button"
            onClick={() => removeRow(item.row.key)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-subtle hover:bg-danger-subtle hover:text-danger transition-colors"
            aria-label="Quitar servicio"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Categoría"
          value={item.row.categoryId}
          onChange={(event) =>
            updateRow(item.row.key, {
              categoryId: event.target.value,
              serviceId: "",
              employeeId: "",
            })
          }
        >
          <option value="" disabled hidden>Selecciona categoría...</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        <Select
          label="Servicio"
          value={item.row.serviceId}
          onChange={(event) =>
            updateRow(item.row.key, {
              serviceId: event.target.value,
              employeeId: "",
            })
          }
          disabled={!item.row.categoryId}
        >
          <option value="" disabled hidden>
            {!item.row.categoryId
              ? "Elige categoría primero"
              : filteredServices.length
                ? "Selecciona servicio..."
                : "Sin servicios"}
          </option>
          {filteredServices.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} ({service.duration_minutes}min)
            </option>
          ))}
        </Select>

        <Select
          label="Profesional"
          value={item.row.employeeId}
          onChange={(event) =>
            updateRow(item.row.key, { employeeId: event.target.value })
          }
          disabled={!item.row.serviceId}
          error={!selectedStillEligible ? "Ya no disponible" : undefined}
        >
          <option value="" disabled hidden>
            {!item.row.serviceId
              ? "Elige servicio primero"
              : eligibleEmployees.length
                ? "Selecciona profesional..."
                : "Nadie disponible"}
          </option>
          {eligibleEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
