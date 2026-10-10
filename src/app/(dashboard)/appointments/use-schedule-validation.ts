"use client";

import { useMemo } from "react";
import {
  buildSequentialSchedule,
  findEligibleEmployees,
  salonWindowFor,
  type AppointmentScheduleItem,
  type AppointmentServiceRow,
  type OccupiedByEmployee,
  type SalonWindow,
  type WizardEmployeeOption,
  type WizardServiceOption,
} from "@/features/appointments/domain/wizard-availability";
import type { BusinessHour, SalonConfig } from "@/features/appointments/domain/types";

export interface ScheduleValidationInput<
  TService extends WizardServiceOption,
  TEmployee extends WizardEmployeeOption,
> {
  date: string;
  time: string;
  rows: AppointmentServiceRow[];
  services: TService[];
  employees: TEmployee[];
  salonConfig: SalonConfig;
  businessHours: BusinessHour[];
  occupied: OccupiedByEmployee;
}

export interface ScheduleValidation<TService extends WizardServiceOption, TEmployee extends WizardEmployeeOption> {
  /** Ventana de apertura del salón para la fecha, o null si cierra ese día. */
  selectedWindow: SalonWindow | null;
  isClosedDay: boolean;
  schedule: AppointmentScheduleItem<TService>[];
  /** Suma de precios de las filas con servicio asignado. */
  total: number;
  /** Profesionales que pueden atender un servicio en un hueco concreto. */
  getEligibleEmployees: (serviceId: string, start: Date | null, end: Date | null) => TEmployee[];
  /** Cada fila del horario tiene servicio, profesional válido y hueco libre. */
  rowsAssignable: boolean;
  /** Fecha y hora fijadas, día abierto y filas asignables. No incluye carga en curso. */
  isScheduleValid: boolean;
}

/**
 * Validación de horario compartida por el asistente de nueva cita y la edición.
 * Solo compone funciones puras del dominio (wizard-availability); no hace E/S.
 */
export function useScheduleValidation<
  TService extends WizardServiceOption,
  TEmployee extends WizardEmployeeOption,
>({
  date,
  time,
  rows,
  services,
  employees,
  salonConfig,
  businessHours,
  occupied,
}: ScheduleValidationInput<TService, TEmployee>): ScheduleValidation<TService, TEmployee> {
  const serviceMap = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services]
  );

  const selectedWindow = useMemo(
    () => salonWindowFor(date, salonConfig.timezone, businessHours),
    [date, salonConfig.timezone, businessHours]
  );

  const schedule = useMemo(
    () => buildSequentialSchedule({ rows, date, time, timeZone: salonConfig.timezone, serviceMap }),
    [rows, date, time, salonConfig.timezone, serviceMap]
  );

  const getEligibleEmployees = useMemo(
    () => (serviceId: string, start: Date | null, end: Date | null) =>
      findEligibleEmployees({
        serviceId,
        start,
        end,
        employees,
        serviceMap,
        salonConfig,
        businessHours,
        occupied,
      }),
    [employees, serviceMap, salonConfig, businessHours, occupied]
  );

  const isClosedDay = !!date && selectedWindow === null;
  const total = rows.reduce((sum, row) => sum + (serviceMap.get(row.serviceId)?.price ?? 0), 0);

  const rowsAssignable = schedule.length > 0 && schedule.every((item) => {
    if (!item.row.serviceId || !item.row.employeeId || !item.start || !item.end) return false;
    return getEligibleEmployees(item.row.serviceId, item.start, item.end)
      .some((employee) => employee.id === item.row.employeeId);
  });

  return {
    selectedWindow,
    isClosedDay,
    schedule,
    total,
    getEligibleEmployees,
    rowsAssignable,
    isScheduleValid: !!date && !!time && rowsAssignable && !isClosedDay,
  };
}
