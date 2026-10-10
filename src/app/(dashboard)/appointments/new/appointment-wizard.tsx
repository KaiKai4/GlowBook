"use client";

import { useState } from "react";
import { AppointmentCustomerStep } from "./appointment-customer-step";
import { AppointmentServicesStep } from "./appointment-services-step";
import { AppointmentStepper } from "./appointment-stepper";
import { AppointmentSummaryStep } from "./appointment-summary-step";
import { useCreateAppointment } from "./use-create-appointment";
import { useCustomerStep } from "./use-customer-step";
import { useAvailability } from "./use-availability";
import { useServiceRows } from "./use-service-rows";
import { useScheduleValidation } from "../use-schedule-validation";
import type { AppointmentWizardProps } from "./appointment-wizard-types";

const STEPS = ["Cliente", "Servicios", "Resumen"] as const;

/** Asistente de nueva cita: compone los pasos y los hooks de cada responsabilidad. */
export function AppointmentWizard({
  customers,
  categories,
  services,
  employees,
  salonConfig,
  businessHours,
}: AppointmentWizardProps) {
  const [step, setStep] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");

  const customer = useCustomerStep({
    customers,
    onValid: (name) => {
      setCustomerName(name);
      setStep(2);
    },
  });
  const availability = useAvailability({ timezone: salonConfig.timezone, businessHours });
  const serviceRows = useServiceRows();
  const { confirm, submitting, submitError } = useCreateAppointment();

  const { date, time, occupied, loadingAvailability } = availability;
  const validation = useScheduleValidation({
    date,
    time,
    rows: serviceRows.rows,
    services,
    employees,
    salonConfig,
    businessHours,
    occupied,
  });
  const canContinueFromServices = validation.isScheduleValid && !loadingAvailability;

  function handleConfirm() {
    confirm({
      mode: customer.mode,
      customerId: customer.customerId,
      newFirst: customer.newFirst,
      newLast: customer.newLast,
      newPhone: customer.newPhone,
      date,
      time,
      timezone: salonConfig.timezone,
      rows: serviceRows.rows,
      notes,
    });
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      <AppointmentStepper steps={STEPS} currentStep={step} />

      {step === 1 && (
        <AppointmentCustomerStep
          customers={customers}
          mode={customer.mode}
          setMode={customer.setMode}
          customerId={customer.customerId}
          setCustomerId={customer.setCustomerId}
          newFirst={customer.newFirst}
          setNewFirst={customer.setNewFirst}
          newLast={customer.newLast}
          setNewLast={customer.setNewLast}
          newPhone={customer.newPhone}
          setNewPhone={customer.setNewPhone}
          error={customer.customerError}
          checkingPhone={customer.checkingPhone}
          onContinue={customer.continueFromCustomer}
          clearError={customer.clearCustomerError}
        />
      )}

      {step === 2 && (
        <AppointmentServicesStep
          date={date}
          setDate={availability.setDate}
          time={time}
          setTime={availability.setTime}
          selectedWindow={validation.selectedWindow}
          isClosedDay={validation.isClosedDay}
          loadingAvailability={loadingAvailability}
          schedule={validation.schedule}
          rowsCount={serviceRows.rows.length}
          categories={categories}
          services={services}
          timezone={salonConfig.timezone}
          dragIndex={serviceRows.dragIndex}
          setDragIndex={serviceRows.setDragIndex}
          getEligibleEmployees={validation.getEligibleEmployees}
          updateRow={serviceRows.updateRow}
          addRow={serviceRows.addRow}
          removeRow={serviceRows.removeRow}
          reorder={serviceRows.reorder}
          onLoadAvailability={availability.loadAvailability}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
          canContinue={canContinueFromServices}
        />
      )}

      {step === 3 && (
        <AppointmentSummaryStep
          customerName={customerName}
          schedule={validation.schedule}
          employees={employees}
          timezone={salonConfig.timezone}
          total={validation.total}
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
