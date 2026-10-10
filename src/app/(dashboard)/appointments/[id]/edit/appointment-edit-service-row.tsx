"use client";

import { GripVertical, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/ui/cn";
import { formatTimeTz } from "@/infra/format/dates";
import { formatCurrency } from "@/infra/format/money";
import type {
  AppointmentScheduleItem,
  AppointmentServiceRow,
  CategoryOption,
  EmployeeOption,
  ServiceOption,
} from "../../new/appointment-wizard-types";

export interface AppointmentEditServiceRowProps {
  index: number;
  row: AppointmentServiceRow;
  item: AppointmentScheduleItem<ServiceOption> | undefined;
  categories: CategoryOption[];
  services: ServiceOption[];
  candidates: EmployeeOption[];
  timezone: string;
  isDragging: boolean;
  canRemove: boolean;
  loadingAvailability: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<AppointmentServiceRow>) => void;
}

/** Tarjeta arrastrable de un servicio de la cita: categoría, servicio, profesional y horario calculado. */
export function AppointmentEditServiceRow({
  index,
  row,
  item,
  categories,
  services,
  candidates,
  timezone,
  isDragging,
  canRemove,
  loadingAvailability,
  onDragStart,
  onDrop,
  onDragEnd,
  onRemove,
  onUpdate,
}: AppointmentEditServiceRowProps) {
  const categoryServices = services.filter((service) => service.category_id === row.categoryId);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-xl border bg-surface p-4 transition-all",
        isDragging ? "border-brand-400 shadow-focus" : "border-brand-100 shadow-hairline"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="cursor-grab text-fg-disabled transition-colors hover:text-fg-subtle">
            <GripVertical className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-fg-secondary">Servicio {index + 1}</span>
          {item?.start && item.end && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
              {formatTimeTz(item.start, timezone)} - {formatTimeTz(item.end, timezone)}
            </span>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-danger-subtle hover:text-danger-strong"
            aria-label="Quitar servicio"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm font-medium text-fg-secondary">
          Categoría
          <Select
            value={row.categoryId}
            onChange={(event) =>
              onUpdate({ categoryId: event.target.value, serviceId: "", employeeId: "" })
            }
          >
            <option value="">Selecciona</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 text-sm font-medium text-fg-secondary">
          Servicio
          <Select
            value={row.serviceId}
            onChange={(event) => onUpdate({ serviceId: event.target.value, employeeId: "" })}
          >
            <option value="">Selecciona</option>
            {categoryServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.duration_minutes} min)
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 text-sm font-medium text-fg-secondary">
          Profesional
          <Select
            value={row.employeeId}
            onChange={(event) => onUpdate({ employeeId: event.target.value })}
            disabled={!row.serviceId || loadingAvailability}
          >
            <option value="">Selecciona</option>
            {candidates.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </Select>
        </label>
      </div>

      {item?.start && item.end && (
        <p className="mt-2 text-xs text-fg-subtle">
          {formatTimeTz(item.start, timezone)} - {formatTimeTz(item.end, timezone)}
          {item.service ? ` · ${formatCurrency(item.service.price)}` : ""}
        </p>
      )}
    </div>
  );
}
