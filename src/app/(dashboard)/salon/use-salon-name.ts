"use client";

import { useState, useTransition } from "react";
import { updateSalonInfoAction } from "./actions";

// Nombre del salón: edición local y guardado con FormData.
export function useSalonName(salonName: string) {
  const [saving, startName] = useTransition();
  const [nameValue, setNameValue] = useState(salonName);
  const [savedName, setSavedName] = useState(salonName);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  function saveName(formData: FormData) {
    setNameError(null);
    setNameSaved(false);
    startName(async () => {
      const result = await updateSalonInfoAction(null, formData);
      if (result.ok) {
        setNameSaved(true);
        setSavedName(nameValue);
      } else setNameError(result.error);
    });
  }

  function editName(value: string) {
    setNameValue(value);
    setNameSaved(false);
    setNameError(null);
  }

  return {
    nameValue,
    editName,
    saving,
    nameSaved,
    nameError,
    saveName,
    dirty: nameValue.trim() !== savedName.trim(),
  };
}

export type SalonNameState = ReturnType<typeof useSalonName>;
