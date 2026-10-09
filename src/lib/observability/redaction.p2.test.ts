import { afterEach, describe, expect, it, vi } from "vitest";
import { sanitizeMetadata, serializeError } from "./redaction";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sanitizeMetadata", () => {
  it("returns an empty object when there is no metadata", () => {
    expect(sanitizeMetadata()).toEqual({});
  });

  it("redacts the value of any key that looks sensitive, whatever its type", () => {
    expect(
      sanitizeMetadata({ apiToken: "abc", userPassword: 1234, service_role: null, cookieHeader: "x" })
    ).toEqual({
      apiToken: "[redacted]",
      userPassword: "[redacted]",
      service_role: "[redacted]",
      cookieHeader: "[redacted]",
    });
  });

  it("keeps numbers, booleans and null untouched", () => {
    expect(sanitizeMetadata({ count: 3, active: true, missing: null, none: undefined })).toEqual({
      count: 3,
      active: true,
      missing: null,
      none: undefined,
    });
  });

  it("masks emails and phone numbers inside string values", () => {
    expect(sanitizeMetadata({ contact: "ana@salon.test llama al +507 6123-4567" })).toEqual({
      contact: "[email] llama al [telefono]",
    });
  });

  it("keeps dates, which have too few digits to be a phone number", () => {
    expect(sanitizeMetadata({ day: "2026-10-09" })).toEqual({ day: "2026-10-09" });
  });

  it("redacts the secret part of inline key=value text", () => {
    expect(sanitizeMetadata({ detail: "secret=s3cr3t-value, ok" })).toEqual({
      detail: "secret=[redacted], ok",
    });
  });

  it("sanitizes each string inside an array and keeps the other items", () => {
    expect(sanitizeMetadata({ emails: ["a@b.test", 7, null] })).toEqual({
      emails: ["[email]", 7, null],
    });
  });

  it("replaces known secret values from the environment wherever they appear", () => {
    vi.stubEnv("GLOWBOOK_TEST_SECRET", "valor-secreto-largo-42");

    expect(sanitizeMetadata({ note: "usado valor-secreto-largo-42 hoy" })).toEqual({
      note: "usado [redacted] hoy",
    });
  });

  it("CONDUCTA ACTUAL (posible bug): a Bearer authorization value keeps its token visible", () => {
    // El patron de texto corta tras la primera palabra del valor ("Bearer"), asi
    // que el token que sigue no se redacta. Se fija el comportamiento actual.
    expect(sanitizeMetadata({ detail: "Authorization: Bearer abc123def" })).toEqual({
      detail: "Authorization: [redacted] abc123def",
    });
  });

  it("CONDUCTA ACTUAL (posible bug): the closing parenthesis after a secret is removed", () => {
    expect(sanitizeMetadata({ detail: "(token=zzz)" })).toEqual({ detail: "(token=[redacted]" });
  });

  it("ignores environment secrets shorter than eight characters", () => {
    vi.stubEnv("GLOWBOOK_TEST_SECRET", "abc");

    expect(sanitizeMetadata({ note: "abc se conserva" })).toEqual({ note: "abc se conserva" });
  });
});

describe("serializeError", () => {
  it("keeps the name and redacts the message and stack of an Error", () => {
    const error = new Error("fallo para ana@salon.test");
    error.stack = "Error: fallo para ana@salon.test\n    at run token=zzz";

    expect(serializeError(error)).toEqual({
      name: "Error",
      message: "fallo para [email]",
      stack: "Error: fallo para [email]\n    at run token=[redacted]",
    });
  });

  it("omits the stack when the Error has none", () => {
    const error = new Error("sin pila");
    error.stack = undefined;

    expect(serializeError(error)).toEqual({ name: "Error", message: "sin pila", stack: undefined });
  });

  it("describes a non-Error value as an unknown error with its redacted text", () => {
    expect(serializeError("contacto: ana@salon.test")).toEqual({
      name: "UnknownError",
      message: "contacto: [email]",
    });
  });
});
