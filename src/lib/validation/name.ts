import { z } from "zod";

// People's names: a letter (any alphabet) followed by letters, spaces and common
// name punctuation (apostrophe, hyphen, period). No digits or other symbols.
export const PERSON_NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;

// Builds a Zod field for a person's name with specific, user-facing messages.
export function personNameField(requiredMsg: string, label = "El nombre") {
  return z
    .string()
    .trim()
    .min(1, requiredMsg)
    .max(120)
    .regex(PERSON_NAME_REGEX, `${label} solo puede contener letras (sin números ni símbolos).`);
}
