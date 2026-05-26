const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidOptionalPhone(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;

  const digits = phoneDigits(trimmed);
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
}

export function phoneValidationMessage(): string {
  return "El telefono debe tener al menos 8 digitos.";
}
