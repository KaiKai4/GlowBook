"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatLocalDateISO, formatTimeTz } from "@/lib/utils/dates";
import {
  buildSequentialSchedule,
  findEligibleEmployees,
  salonWindowFor,
  type AppointmentServiceRow,
  type OccupiedByEmployee,
} from "@/features/appointments/domain/wizard-availability";
import type { AppointmentDetailViewModel } from "@/features/appointments/use-cases/get-appointment-detail";
import type { AppointmentWizardProps } from "../../new/appointment-wizard-types";
import {
  getOccupiedSlotsForEditDate,
  updateAppointmentScheduleAction,
} from "../../actions";

interface Props extends Omit<AppointmentWizardProps, "customers"> {
  appointment: AppointmentDetailViewModel;
}

function localTime(date: Date, timeZone: string): string {
  const value = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return value === "24:00" ? "00:00" : value;
}

function rowKey(index: number): string {
  return `edit-${index}-${crypto.randomUUID()}`;
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
  const [loadingAvailability, startAvailability] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    () => buildSequentialSchedule({ rows, date, time, serviceMap }),
    [rows, date, time, serviceMap]
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

  function moveRow(index: number, direction: -1 | 1) {
    setRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  }

  function submit() {
    setSubmitError(null);

    startSubmit(async () => {
      const base = new Date(`${date}T${time}:00`);
      const formData = new FormData();
      formData.set("appointment_id", appointment.id);
      formData.set("start_time", base.toISOString());
      formData.set("notes", notes);
      formData.set(
        "assignments",
        JSON.stringify(rows.map((row) => ({
          service_id: row.serviceId,
          employee_id: row.employeeId,
        })))
      );

      const result = await updateAppointmentScheduleAction(null, formData);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      router.push(`/appointments/${appointment.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Horario</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            Fecha
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            Hora
            <Input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
          {isClosedDay && (
            <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              El salÃ³n estÃ¡ cerrado ese dÃ­a.
            </p>
          )}
          {selectedWindow && (
            <p className="sm:col-span-2 text-xs text-neutral-500">
              Horario del salÃ³n: {selectedWindow.open} - {selectedWindow.close}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Servicios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, index) => {
            const item = schedule[index];
            const categoryServices = services.filter((service) => service.category_id === row.categoryId);
            const candidates = eligibleEmployees(row.serviceId, item?.start ?? null, item?.end ?? null);

            return (
              <div key={row.key} className="rounded-lg border border-neutral-200 p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <label className="space-y-1 text-sm font-medium text-neutral-700">
                    CategorÃ­a
                    <Select
                      value={row.categoryId}
                      onChange={(event) =>
                        updateRow(row.key, {
                          categoryId: event.target.value,
                          serviceId: "",
                          employeeId: "",
                        })
                      }
                    >
                      <option value="">Selecciona</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </Select>
                  </label>

                  <label className="space-y-1 text-sm font-medium text-neutral-700">
                    Servicio
                    <Select
                      value={row.serviceId}
                      onChange={(event) => updateRow(row.key, { serviceId: event.target.value, employeeId: "" })}
                    >
                      <option value="">Selecciona</option>
                      {categoryServices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} ({service.duration_minutes} min)
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="space-y-1 text-sm font-medium text-neutral-700">
                    Profesional
                    <Select
                      value={row.employeeId}
                      onChange={(event) => updateRow(row.key, { employeeId: event.target.value })}
                      disabled={!row.serviceId || loadingAvailability}
                    >
                      <option value="">Selecciona</option>
                      {candidates.map((employee) => (
                        <option key={employee.id} value={employee.id}>{employee.name}</option>
                      ))}
                    </Select>
                  </label>

                  <div className="flex items-end gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => moveRow(index, -1)}>
                      Subir
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => moveRow(index, 1)}>
                      Bajar
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(row.key)}>
                      Quitar
                    </Button>
                  </div>
                </div>

                {item?.start && item.end && (
                  <p className="mt-2 text-xs text-neutral-500">
                    {formatTimeTz(item.start, salonConfig.timezone)} - {formatTimeTz(item.end, salonConfig.timezone)}
                    {item.service ? ` Â· ${formatCurrency(item.service.price)}` : ""}
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={addRow}>
              Agregar servicio
            </Button>
            <p className="text-sm font-semibold text-neutral-900">Total: {formatCurrency(total)}</p>
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
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push(`/appointments/${appointment.id}`)}>
          Cancelar
        </Button>
        <Button type="button" variant="primary" loading={submitting} disabled={!canSubmit} onClick={submit}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
