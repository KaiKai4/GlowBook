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

  it("a Bearer authorization value keeps the scheme and hides the token", () => {
    expect(sanitizeMetadata({ detail: "Authorization: Bearer abc123def" })).toEqual({
      detail: "Authorization: Bearer [redacted]",
    });
  });

  it("hides a Bearer token that appears without its header keyword", () => {
    expect(sanitizeMetadata({ detail: "invalid Bearer abc123def456 en la cola" })).toEqual({
      detail: "invalid Bearer [redacted] en la cola",
    });
  });

  it("hides a Basic authorization value", () => {
    expect(sanitizeMetadata({ detail: "Authorization: Basic dXNlcjpwYXNz" })).toEqual({
      detail: "Authorization: Basic [redacted]",
    });
  });

  it("hides a JWT even when it is not preceded by a keyword", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";

    expect(sanitizeMetadata({ detail: `llamada con ${jwt} fallida` })).toEqual({
      detail: "llamada con [redacted] fallida",
    });
  });

  it("keeps the closing parenthesis after a secret", () => {
    expect(sanitizeMetadata({ detail: "(token=zzz)" })).toEqual({ detail: "(token=[redacted])" });
  });

  it("stops a cookie value at the semicolon separator", () => {
    expect(sanitizeMetadata({ detail: "cookie: sb=abc; ok=1" })).toEqual({
      detail: "cookie: [redacted]; ok=1",
    });
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
