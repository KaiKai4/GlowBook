"use client";

import { useState, useTransition } from "react";
import {
  normalizePaymentMethods,
  type PaymentMethod,
} from "@/features/payments/domain/payment-methods";
import { updateSalonPaymentMethodsAction } from "./actions";
import { validateNewPaymentMethod } from "./salon-rules";

// Métodos de pago aceptados: alta, baja y guardado de la lista del salón.
export function usePaymentMethods(paymentMethods: PaymentMethod[]) {
  const [enabledPayments, setEnabledPayments] = useState<PaymentMethod[]>(paymentMethods);
  const [savedPayments, setSavedPayments] = useState<PaymentMethod[]>(paymentMethods);
  const [saving, startPayments] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState("");

  function changeNewPaymentMethod(value: string) {
    setNewPaymentMethod(value);
    setError(null);
    setSaved(false);
  }

  function addPaymentMethod(value: string) {
    setSaved(false);
    setError(null);
    const result = validateNewPaymentMethod(value, enabledPayments);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEnabledPayments((current) => [...current, result.method]);
    setNewPaymentMethod("");
  }

  function removePaymentMethod(method: PaymentMethod) {
    setSaved(false);
    setError(null);
    setEnabledPayments((current) => current.filter((item) => item !== method));
  }

  function savePaymentMethods() {
    setError(null);
    setSaved(false);
    const methodsToSave = normalizePaymentMethods(enabledPayments);

    if (methodsToSave.length === 0) {
      setError("Agrega al menos un metodo de pago.");
      return;
    }

    startPayments(async () => {
      const result = await updateSalonPaymentMethodsAction(methodsToSave);
      if (result.ok) {
        setSaved(true);
        setEnabledPayments(methodsToSave);
        setSavedPayments(methodsToSave);
      } else setError(result.error);
    });
  }

  return {
    enabledPayments,
    newPaymentMethod,
    changeNewPaymentMethod,
    addPaymentMethod,
    removePaymentMethod,
    savePaymentMethods,
    saving,
    saved,
    error,
    dirty: JSON.stringify(enabledPayments) !== JSON.stringify(savedPayments),
  };
}

export type PaymentMethodsState = ReturnType<typeof usePaymentMethods>;
