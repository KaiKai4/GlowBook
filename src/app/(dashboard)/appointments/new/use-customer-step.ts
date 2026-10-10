"use client";

import { useState, useTransition } from "react";
import { isValidOptionalPhone, phoneValidationMessage } from "@/infra/format/phone";
import { checkCustomerPhoneAction } from "../../customers/actions";
import type { CustomerOption } from "./appointment-wizard-types";

/**
 * Paso 1 del asistente: cliente existente o nuevo. Valida el formulario y, si hay
 * teléfono, comprueba que no esté ya registrado. Llama a `onValid` con el nombre a mostrar.
 */
export function useCustomerStep({
  customers,
  onValid,
}: {
  customers: CustomerOption[];
  onValid: (customerName: string) => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");
  const [customerId, setCustomerId] = useState("");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [checkingPhone, startCheckPhone] = useTransition();
  const [customerError, setCustomerError] = useState<string | null>(null);

  function clearCustomerError() {
    setCustomerError(null);
  }

  function continueFromCustomer() {
    setCustomerError(null);

    if (mode === "existing") {
      if (!customerId) return;
      onValid(customers.find((customer) => customer.id === customerId)?.name ?? "");
      return;
    }

    if (!newFirst.trim() || !newLast.trim()) {
      setCustomerError("Nombre y apellido son obligatorios.");
      return;
    }

    if (!newPhone.trim()) {
      onValid(`${newFirst} ${newLast}`);
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
            ? "Este numero pertenece a un cliente existente. Restauralo desde Clientes para conservar su historial."
            : "Este numero ya esta registrado. Buscalo en Cliente existente."
        );
        return;
      }

      onValid(`${newFirst} ${newLast}`);
    });
  }

  return {
    mode, setMode,
    customerId, setCustomerId,
    newFirst, setNewFirst,
    newLast, setNewLast,
    newPhone, setNewPhone,
    checkingPhone,
    customerError,
    clearCustomerError,
    continueFromCustomer,
  };
}
