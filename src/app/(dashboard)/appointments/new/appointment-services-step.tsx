"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { formatTimeTz } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { GripVertical, Plus, Scissors, Trash2 } from "lucide-react";
import type {
  AppointmentScheduleItem,
  AppointmentServiceRow,
  CategoryOption,
  EmployeeOption,
  SalonWindow,
  ServiceOption,
} from "./appointment-wizard-types";

export function AppointmentServicesStep({
  date,
  setDate,
  time,
  setTime,
  selectedWindow,
  isClosedDay,
  loadingAvailability,
  schedule,
  rowsCount,
  categories,
  services,
  timezone,
  dragIndex,
  setDragIndex,
  getEligibleEmployees,
  updateRow,
  addRow,
  removeRow,
  reorder,
  onLoadAvailability,
  onBack,
  onContinue,
  canContinue,
}: {
  date: string;
  setDate: (date: string) => void;
  time: string;
  setTime: (time: string) => void;
  selectedWindow: SalonWindow | null;
  isClosedDay: boolean;
  loadingAvailability: boolean;
  schedule: AppointmentScheduleItem[];
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
  updateRow: (key: string, patch: Partial<AppointmentServiceRow>) => void;
  addRow: () => void;
  removeRow: (key: string) => void;
  reorder: (from: number, to: number) => void;
  onLoadAvailability: (date: string) => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-brand-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-choco-50">
          <Scissors className="h-4 w-4 text-choco-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-fg-secondary">Servicios y horario</h2>
          <p className="text-xs text-fg-subtle">Define fecha, hora y servicios a realizar</p>
        </div>
      </div>

      <CardContent className="space-y-6 pt-5">
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-surface-muted border border-border-subtle">
          <DatePicker
            label="Fecha"
            value={date}
            onChange={(nextDate) => {
              setDate(nextDate);
              onLoadAvailability(nextDate);
            }}
            required
          />
          <TimePicker
            label="Hora de inicio"
            value={time}
            onChange={setTime}
            min={selectedWindow?.open ?? "06:00"}
            max={selectedWindow?.close ?? "21:30"}
            maxExclusive
          />
        </div>

        {!date ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center">
            <p className="text-sm text-fg-subtle">Elige una fecha para ver disponibilidad.</p>
          </div>
        ) : isClosedDay ? (
          <div className="rounded-xl border border-dashed border-warning-border bg-warning-subtle py-8 text-center">
            <p className="text-sm font-medium text-warning-fg">El salon esta cerrado ese día.</p>
            <p className="text-xs text-warning-fg mt-0.5">
              Elige otra fecha o ajusta los horarios en Configuración del salon.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-fg-subtle uppercase tracking-wide">Servicios</p>
              {loadingAvailability && (
                <span className="text-xs text-brand-600 animate-pulse">
                  Cargando disponibilidad...
                </span>
              )}
            </div>

            <p className="text-xs text-fg-subtle flex items-center gap-1">
              <GripVertical className="h-3 w-3" />
              Arrastra para cambiar el orden de los servicios
            </p>

            {schedule.map((item, index) => {
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
                  key={item.row.key}
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
                      ? "border-brand-400 shadow-[0_0_0_2px_rgba(124,58,237,0.15)]"
                      : "border-brand-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
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
                      label="Categoria"
                      value={item.row.categoryId}
                      onChange={(event) =>
                        updateRow(item.row.key, {
                          categoryId: event.target.value,
                          serviceId: "",
                          employeeId: "",
                        })
                      }
                    >
                      <option value="">Selecciona categoria...</option>
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
                      <option value="">
                        {!item.row.categoryId
                          ? "Elige categoria primero"
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
                      <option value="">
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
            })}

            <Button variant="outline" size="sm" onClick={addRow} className="w-full border-dashed">
              <Plus className="h-4 w-4" /> Agregar otro servicio
            </Button>
          </div>
        )}

        <div className="flex justify-between pt-2 border-t border-border-subtle">
          <Button variant="ghost" onClick={onBack}>
            Atras
          </Button>
          <Button variant="primary" size="lg" onClick={onContinue} disabled={!canContinue}>
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
