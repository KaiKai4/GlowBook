import { describe, expect, it } from "vitest";
import { buildReportsHref } from "./report-url";

describe("buildReportsHref", () => {
  it("serializes a preset report filter", () => {
    expect(buildReportsHref({ preset: "90dias" })).toBe("/reports?preset=90dias");
  });

  it("serializes a custom date range", () => {
    expect(buildReportsHref({ from: "2026-06-01", to: "2026-06-07" })).toBe(
      "/reports?from=2026-06-01&to=2026-06-07"
    );
  });

  it("keeps the reports root for empty input", () => {
    expect(buildReportsHref({})).toBe("/reports");
  });
});
