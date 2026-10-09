import { describe, expect, it } from "vitest";
import { parseCspReport } from "./csp-report";

describe("parseCspReport", () => {
  it("summarizes a legacy application/csp-report without query strings", () => {
    const body = {
      "csp-report": {
        "document-uri": "https://app.glowbook.test/clientes/12?token=abc#x",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://cdn.evil.test/payload.js?sid=secret",
      },
    };

    expect(parseCspReport("application/csp-report", body)).toEqual([
      {
        directive: "script-src-elem",
        blockedOrigin: "https://cdn.evil.test",
        documentPath: "/clientes/12",
      },
    ]);
  });

  it("falls back to violated-directive when effective-directive is missing", () => {
    const body = { "csp-report": { "violated-directive": "style-src", "blocked-uri": "inline" } };

    expect(parseCspReport("application/csp-report", body)).toEqual([
      { directive: "style-src", blockedOrigin: "inline", documentPath: "none" },
    ]);
  });

  it("keeps only csp-violation entries from application/reports+json", () => {
    const body = [
      { type: "deprecation", body: { id: "x" } },
      {
        type: "csp-violation",
        body: {
          documentURL: "https://app.glowbook.test/login",
          effectiveDirective: "img-src",
          blockedURL: "https://img.example.test/a.png",
        },
      },
    ];

    expect(parseCspReport("application/reports+json", body)).toEqual([
      { directive: "img-src", blockedOrigin: "https://img.example.test", documentPath: "/login" },
    ]);
  });

  it("marks unparseable URLs as invalid instead of echoing them", () => {
    const body = {
      "csp-report": { "document-uri": "not a url", "effective-directive": "img-src", "blocked-uri": "::bad::" },
    };

    expect(parseCspReport("application/csp-report", body)).toEqual([
      { directive: "img-src", blockedOrigin: "invalid", documentPath: "invalid" },
    ]);
  });

  it("rejects bodies that do not match the expected shape", () => {
    expect(parseCspReport("application/csp-report", { foo: 1 })).toBeNull();
    expect(parseCspReport("application/reports+json", { type: "csp-violation" })).toBeNull();
  });

  it("rejects unsupported content types", () => {
    expect(parseCspReport("application/json", { "csp-report": {} })).toBeNull();
  });

  it("rejects oversized field values", () => {
    const body = { "csp-report": { "blocked-uri": "https://x.test/" + "a".repeat(2100) } };

    expect(parseCspReport("application/csp-report", body)).toBeNull();
  });
});
