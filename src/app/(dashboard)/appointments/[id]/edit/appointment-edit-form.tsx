"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatLocalDateISO } from "@/lib/utils/dates";
import { AppointmentEditReview } from "./appointment-edit-review";
import { AppointmentEditScheduleCard } from "./appointment-edit-schedule-card";
import { AppointmentEditServiceRow } from "./appointment-edit-service-row";
import { useAppointmentEditSubmit } from "./use-appointment-edit-submit";
import { localTime, rowKey } from "./appointment-edit-helpers";
import {
  buildSequentialSchedule,
  findEligibleEmployees,
  salonWindowFor,
  type AppointmentServiceRow,
  type OccupiedByEmployee,
} from "@/features/appointments/domain/wizard-availability";
import type { AppointmentDetailViewModel } from "@/features/appointments/use-cases/get-appointment-detail";
import type { AppointmentWizardProps } from "../../new/appointment-wizard-types";
import { getOccupiedSlotsForEditDate } from "../../actions";

interface Props extends Omit<AppointmentWizardProps, "customers"> {
  appointment: AppointmentDetailViewModel;
}

export function AppointmentEditForm({
  appointment,
  categories,
  services,
  employees,
  salonConfig,
  businessHours,
}: Props) {
  const router = useRouter();
  const initialStart = appointment.start_time ? new Date(appointment.start_time) : new Date();
  const serviceMap = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services]
  );

  const [date, setDate] = useState(formatLocalDateISO(initialStart, appointment.timezone));
  const [time, setTime] = useState(localTime(initialStart, appointment.timezone));
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const [rows, setRows] = useState<AppointmentServiceRow[]>(
    appointment.items.map((item, index) => {
      const service = serviceMap.get(item.serviceId);
      return {
        key: rowKey(index),
        categoryId: service?.category_id ?? "",
        serviceId: item.serviceId,
        employeeId: item.employeeId,
      };
    })
  );
  const [occupied, setOccupied] = useState<OccupiedByEmployee>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [loadingAvailability, startAvailability] = useTransition();
  const [reviewing, setReviewing] = useState(false);
  const { submit, submitting, submitError, setSubmitError } = useAppointmentEditSubmit({
    appointment,
    date,
    time,
    notes,
    rows,
  });

  useEffect(() => {
    if (!date) return;
    startAvailability(async () => {
      const slots = await getOccupiedSlotsForEditDate(date, appointment.id);
      setOccupied(slots);
    });
  }, [appointment.id, date]);

  const selectedWindow = useMemo(
    () => salonWindowFor(date, salonConfig.timezone, businessHours),
    [date, salonConfig.timezone, businessHours]
  );

  const schedule = useMemo(
    () => buildSequentialSchedule({ rows, date, time, timeZone: salonConfig.timezone, serviceMap }),
    [rows, date, time, salonConfig.timezone, serviceMap]
  );

  const isClosedDay = !!date && selectedWindow === null;
  const total = rows.reduce((sum, row) => sum + (serviceMap.get(row.serviceId)?.price ?? 0), 0);

  function eligibleEmployees(serviceId: string, start: Date | null, end: Date | null) {
    return findEligibleEmployees({
      serviceId,
      start,
      end,
      employees,
      serviceMap,
      salonConfig,
      businessHours,
      occupied,
    });
  }

  const rowsValid = schedule.length > 0 && schedule.every((item) => {
    if (!item.row.serviceId || !item.row.employeeId || !item.start || !item.end) return false;
    return eligibleEmployees(item.row.serviceId, item.start, item.end)
      .some((employee) => employee.id === item.row.employeeId);
  });

  const canSubmit = !!date && !!time && rowsValid && !isClosedDay && !loadingAvailability;

  function updateRow(key: string, patch: Partial<AppointmentServiceRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { key: rowKey(current.length), categoryId: "", serviceId: "", employeeId: "" },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  }

  function reorderRows(from: number, to: number) {
    setRows((current) => {
      if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) return current;
      const next = [...current];
      const [row] = next.splice(from, 1);
      if (row === undefined) return current;
      next.splice(to, 0, row);
      return next;
    });
  }

  if (reviewing) {
    return (
      <AppointmentEditReview
        date={date}
        notes={notes}
        time={time}
        timeZone={salonConfig.timezone}
        schedule={schedule}
        total={total}
        employeeName={(employeeId) =>
          employees.find((candidate) => candidate.id === employeeId)?.name
        }
        submitError={submitError}
        submitting={submitting}
        onBack={() => {
          setSubmitError(null);
          setReviewing(false);
        }}
        onConfirm={submit}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AppointmentEditScheduleCard
        date={date}
        time={time}
        selectedWindow={selectedWindow}
        isClosedDay={isClosedDay}
        onDateChange={setDate}
        onTimeChange={setTime}
      />

      <Card>
        <CardHeader>
          <CardTitle>Servicios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-fg-subtle flex items-center gap-1">
            <GripVertical className="h-3 w-3" />
            Arrastra para cambiar el orden de los servicios
          </p>

          {rows.map((row, index) => {
            const item = schedule[index];
            return (
              <AppointmentEditServiceRow
                key={row.key}
                index={index}
                row={row}
                item={item}
                categories={categories}
                services={services}
                candidates={eligibleEmployees(row.serviceId, item?.start ?? null, item?.end ?? null)}
                timezone={salonConfig.timezone}
                isDragging={dragIndex === index}
                canRemove={rows.length > 1}
                loadingAvailability={loadingAvailability}
                onDragStart={() => setDragIndex(index)}
                onDrop={() => {
                  if (dragIndex !== null) reorderRows(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                onRemove={() => removeRow(row.key)}
                onUpdate={(patch) => updateRow(row.key, patch)}
              />
            );
          })}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={addRow}>
              Agregar servicio
            </Button>
            <p className="text-sm font-semibold text-fg">Total: {formatCurrency(total)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Notas internas de la cita"
          />
        </CardContent>
      </Card>

      {submitError && (
        <p className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger-strong">{submitError}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/appointments")}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!canSubmit}
          onClick={() => {
            setSubmitError(null);
            setReviewing(true);
          }}
        >
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
