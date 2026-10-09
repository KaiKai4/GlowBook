import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  SubmitFeedbackSchema,
} from "./schemas";

// Validacion del reporte de feedback del salon: categoria cerrada y mensaje
// entre 5 y 2000 caracteres tras recortar los espacios de los extremos.

const VALID_CATEGORY = "bug" as const;

function messageIssue(message: string): string | undefined {
  const result = SubmitFeedbackSchema.safeParse({ category: VALID_CATEGORY, message });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("SubmitFeedbackSchema categories", () => {
  it("accepts every declared category", () => {
    for (const category of FEEDBACK_CATEGORIES) {
      const result = SubmitFeedbackSchema.safeParse({ category, message: "Mensaje valido" });
      expect(result.success).toBe(true);
    }
  });

  it("rejects categories outside the closed list", () => {
    fc.assert(
      fc.property(
        fc.string().filter((value) => !(FEEDBACK_CATEGORIES as readonly string[]).includes(value)),
        (category) => {
          const result = SubmitFeedbackSchema.safeParse({ category, message: "Mensaje valido" });
          return result.success === false;
        }
      )
    );
  });

  it("gives every category a Spanish label", () => {
    expect(FEEDBACK_CATEGORY_LABELS).toEqual({
      bug: "Falla / Error",
      suggestion: "Sugerencia",
      question: "Pregunta / Ayuda",
      other: "Otro",
    });
  });
});

describe("SubmitFeedbackSchema message length", () => {
  it("rejects a message that is short once trimmed, even if padded with spaces", () => {
    expect(messageIssue("   abcd   ")).toBe("Cuéntanos un poco más (mínimo 5 caracteres).");
  });

  it("accepts a message of exactly 5 characters", () => {
    expect(messageIssue("abcde")).toBeUndefined();
  });

  it("accepts a message of exactly 2000 characters", () => {
    expect(messageIssue("a".repeat(2000))).toBeUndefined();
  });

  it("rejects a message of 2001 characters", () => {
    expect(messageIssue("a".repeat(2001))).toBe("El mensaje es demasiado largo.");
  });

  it("stores the trimmed message", () => {
    const result = SubmitFeedbackSchema.safeParse({ category: "suggestion", message: "  Hola equipo  " });

    expect(result).toEqual({
      success: true,
      data: { category: "suggestion", message: "Hola equipo" },
    });
  });

  it("measures the limits on the trimmed text, not on the raw input", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 2000 }),
        fc.integer({ min: 0, max: 20 }),
        (length, padding) => {
          const core = "x".repeat(length);
          const spaces = " ".repeat(padding);
          const result = SubmitFeedbackSchema.safeParse({
            category: VALID_CATEGORY,
            message: `${spaces}${core}${spaces}`,
          });
          return result.success && result.data.message === core;
        }
      )
    );
  });

  it("rejects every trimmed length below 5 characters", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4 }), (length) => {
        return messageIssue("x".repeat(length)) !== undefined;
      })
    );
  });
});
