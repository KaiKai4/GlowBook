"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isValidOptionalPhone, phoneValidationMessage } from "@/lib/utils/phone";
import { createAppointmentAction, getOccupiedSlotsForDate } from "../actions";
import { checkCustomerPhoneAction, findOrCreateCustomerAction } from "../../customers/actions";
import { AppointmentCustomerStep } from "./appointment-customer-step";
import { AppointmentServicesStep } from "./appointment-services-step";
import { AppointmentStepper } from "./appointment-stepper";
import { AppointmentSummaryStep } from "./appointment-summary-step";
import {
  buildSequentialSchedule,
  createAppointmentRow,
  findEligibleEmployees,
  salonWindowFor,
} from "@/features/appointments/domain/wizard-availability";
import type {
  AppointmentServiceRow,
  AppointmentWizardProps,
  OccupiedByEmployee,
} from "./appointment-wizard-types";

const STEPS = ["Cliente", "Servicios", "Resumen"] as const;

let rowSeq = 0;
const newRow = (): AppointmentServiceRow => createAppointmentRow(rowSeq++);

export function AppointmentWizard({
  customers,
  categories,
  services,
  employees,
  salonConfig,
  businessHours,
}: AppointmentWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [mode, setMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [checkingPhone, startCheckPhone] = useTransition();
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [rows, setRows] = useState<AppointmentServiceRow[]>([newRow()]);
  const [occupied, setOccupied] = useState<OccupiedByEmployee>({});
  const [loadingAvailability, startAvailability] = useTransition();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [notes, setNotes] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const serviceMap = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services]
  );

  const selectedWindow = useMemo(
    () => salonWindowFor(date, salonConfig.timezone, businessHours),
    [date, salonConfig.timezone, businessHours]
  );

  const schedule = useMemo(
    () => buildSequentialSchedule({ rows, date, time, serviceMap }),
    [rows, date, time, serviceMap]
  );

  const isClosedDay = !!date && selectedWindow === null;
  const validRows = rows.filter((row) => row.serviceId && row.employeeId);
  const total = validRows.reduce(
    (sum, row) => sum + (serviceMap.get(row.serviceId)?.price ?? 0),
    0
  );

  function getEligibleEmployees(serviceId: string, start: Date | null, end: Date | null) {
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

  const assignmentsStillValid = schedule.length > 0 && schedule.every((item) => {
    if (!item.row.serviceId || !item.row.employeeId || !item.start || !item.end) return false;
    return getEligibleEmployees(item.row.serviceId, item.start, item.end)
      .some((employee) => employee.id === item.row.employeeId);
  });

  const canContinueFromServices =
    assignmentsStillValid && !!date && !!time && !isClosedDay && !loadingAvailability;

  function clearCustomerError() {
    setCustomerError(null);
  }

  function continueFromCustomer() {
    setCustomerError(null);

    if (mode === "existing") {
      if (!customerId) return;
      setCustomerName(customers.find((customer) => customer.id === customerId)?.name ?? "");
      setStep(2);
      return;
    }

    if (!newFirst.trim() || !newLast.trim()) {
      setCustomerError("Nombre y apellido son obligatorios.");
      return;
    }

    if (!newPhone.trim()) {
      setCustomerName(`${newFirst} ${newLast}`);
      setStep(2);
      return;
    }

    if (!isValidOptionalPhone(newPhone)) {
      setCustomerError(phoneValidationMessage());
      return;
    }

    startCheckPhone(async () => {
      const { exists, archived } = await checkCustomerPhoneAction(newPhone);
      if (exists) {
        setCustomerError(
          archived
            ? "Este numero pertenece a un cliente archivado. Reactivalo en Clientes > Archivados antes de agendar."
            : "Este numero ya esta registrado. Buscalo en Cliente existente."
        );
        return;
      }

      setCustomerName(`${newFirst} ${newLast}`);
      setStep(2);
    });
  }

  function loadAvailability(nextDate: string) {
    if (!nextDate) return;

    const windowForDate = salonWindowFor(nextDate, salonConfig.timezone, businessHours);
    if (windowForDate && (time < windowForDate.open || time >= windowForDate.close)) {
      setTime(windowForDate.open);
    }

    startAvailability(async () => {
      const slots = await getOccupiedSlotsForDate(nextDate);
      setOccupied(slots);
    });
  }

  function updateRow(key: string, patch: Partial<AppointmentServiceRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;

    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleConfirm() {
    setSubmitError(null);

    startSubmit(async () => {
      let finalCustomerId = customerId;

      if (mode === "new") {
        const customerResult = await findOrCreateCustomerAction(
          newFirst,
          newLast,
          newPhone || undefined
        );

        if (!customerResult.ok) {
          setSubmitError(customerResult.error);
          return;
        }

        finalCustomerId = customerResult.value;
      }

      const base = new Date(`${date}T${time}:00`);
      const formData = new FormData();
      formData.set("customer_id", finalCustomerId);
      formData.set("start_time", base.toISOString());
      formData.set("notes", notes);
      formData.set(
        "assignments",
        JSON.stringify(
          rows.map((row) => ({
            service_id: row.serviceId,
            employee_id: row.employeeId,
          }))
        )
      );

      const result = await createAppointmentAction(null, formData);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      router.push(`/appointments?date=${date}`);
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      <AppointmentStepper steps={STEPS} currentStep={step} />

      {step === 1 && (
        <AppointmentCustomerStep
          customers={customers}
          mode={mode}
          setMode={setMode}
          customerId={customerId}
          setCustomerId={setCustomerId}
          newFirst={newFirst}
          setNewFirst={setNewFirst}
          newLast={newLast}
          setNewLast={setNewLast}
          newPhone={newPhone}
          setNewPhone={setNewPhone}
          error={customerError}
          checkingPhone={checkingPhone}
          onContinue={continueFromCustomer}
          clearError={clearCustomerError}
        />
      )}

      {step === 2 && (
        <AppointmentServicesStep
          date={date}
          setDate={setDate}
          time={time}
          setTime={setTime}
          selectedWindow={selectedWindow}
          isClosedDay={isClosedDay}
          loadingAvailability={loadingAvailability}
          schedule={schedule}
          rowsCount={rows.length}
          categories={categories}
          services={services}
          timezone={salonConfig.timezone}
          dragIndex={dragIndex}
          setDragIndex={setDragIndex}
          getEligibleEmployees={getEligibleEmployees}
          updateRow={updateRow}
          addRow={addRow}
          removeRow={removeRow}
          reorder={reorder}
          onLoadAvailability={loadAvailability}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
          canContinue={canContinueFromServices}
        />
      )}

      {step === 3 && (
        <AppointmentSummaryStep
          customerName={customerName}
          schedule={schedule}
          employees={employees}
          timezone={salonConfig.timezone}
          total={total}
          notes={notes}
          setNotes={setNotes}
          submitError={submitError}
          submitting={submitting}
          onBack={() => setStep(2)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
