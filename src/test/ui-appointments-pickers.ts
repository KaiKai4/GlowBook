// Dobles de entrada para DatePicker y TimePicker en los tests de la agenda.
// Su calendario y reloj desplegables tienen tests propios; aquí solo importa
// que el componente de citas pase el valor correcto y reciba el cambio. Se
// exponen como <input> nativo con aria-label y data-min/data-max para afirmar
// los límites del horario que calcula el asistente.
import { createElement, type ChangeEvent } from "react";

interface PickerDoubleProps {
  label?: string;
  ariaLabel?: string;
  value?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  onChange?: (value: string) => void;
}

function inputChange(onChange?: (value: string) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value);
}

export function DatePicker({ label, ariaLabel, value, disabled, onChange }: PickerDoubleProps) {
  return createElement("input", {
    type: "date",
    "aria-label": ariaLabel ?? label,
    value: value ?? "",
    disabled,
    onChange: inputChange(onChange),
  });
}

export function TimePicker({ label, value, disabled, min, max, onChange }: PickerDoubleProps) {
  return createElement("input", {
    type: "time",
    "aria-label": label,
    value: value ?? "",
    disabled,
    "data-min": min,
    "data-max": max,
    onChange: inputChange(onChange),
  });
}
