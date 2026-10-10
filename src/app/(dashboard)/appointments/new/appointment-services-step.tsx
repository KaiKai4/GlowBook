"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { GripVertical, Plus, Scissors } from "lucide-react";
import type {
  AppointmentScheduleItem,
  AppointmentServiceRow as ServiceRow,
  CategoryOption,
  EmployeeOption,
  SalonWindow,
  ServiceOption,
} from "./appointment-wizard-types";
import { AppointmentServiceRow } from "./appointment-service-row";

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
  updateRow: (key: string, patch: Partial<ServiceRow>) => void;
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

            {schedule.map((item, index) => (
              <AppointmentServiceRow
                key={item.row.key}
                item={item}
                index={index}
                rowsCount={rowsCount}
                categories={categories}
                services={services}
                timezone={timezone}
                dragIndex={dragIndex}
                setDragIndex={setDragIndex}
                getEligibleEmployees={getEligibleEmployees}
                updateRow={updateRow}
                removeRow={removeRow}
                reorder={reorder}
              />
            ))}

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
