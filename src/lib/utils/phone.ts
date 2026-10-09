const MAX_PHONE_DIGITS = 15;
const PANAMA_COUNTRY_CODE = "507";
const PANAMA_MOBILE_LENGTH = 8;
const PANAMA_MOBILE_PREFIX = "6";

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeOptionalPhoneInput(value: string): string {
  let digits = phoneDigits(value);
  if (digits.startsWith(PANAMA_COUNTRY_CODE) && digits.length > PANAMA_COUNTRY_CODE.length) {
    digits = digits.slice(PANAMA_COUNTRY_CODE.length);
  }

  return digits.slice(0, PANAMA_MOBILE_LENGTH);
}

export function isValidOptionalPhone(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;

  const digits = normalizeOptionalPhoneInput(trimmed);
  return (
    digits.length === PANAMA_MOBILE_LENGTH &&
    digits.startsWith(PANAMA_MOBILE_PREFIX) &&
    phoneDigits(trimmed).length <= MAX_PHONE_DIGITS
  );
}

export function phoneValidationMessage(): string {
  return "El celular debe tener 8 digitos y comenzar con 6.";
}
