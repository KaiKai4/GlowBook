import { describe, expect, it } from "vitest";
import { matchesSummaryFilter, SUMMARY_FILTERS } from "./summary-filter";

const LIFECYCLE_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

describe("appointment summary filters", () => {
  it.each(LIFECYCLE_STATUSES)("shows %s appointments in at least one tab", (status) => {
    const visible = SUMMARY_FILTERS.some((filter) => matchesSummaryFilter(status, filter.value));
    expect(visible).toBe(true);
  });

  it("shows no-show appointments only in the no-show tab", () => {
    expect(matchesSummaryFilter("no_show", "no_show")).toBe(true);
    expect(matchesSummaryFilter("no_show", "upcoming")).toBe(false);
    expect(matchesSummaryFilter("no_show", "completed")).toBe(false);
    expect(matchesSummaryFilter("no_show", "cancelled")).toBe(false);
  });

  it("groups scheduled and confirmed appointments as upcoming", () => {
    expect(matchesSummaryFilter("scheduled", "upcoming")).toBe(true);
    expect(matchesSummaryFilter("confirmed", "upcoming")).toBe(true);
    expect(matchesSummaryFilter("completed", "upcoming")).toBe(false);
  });
});
