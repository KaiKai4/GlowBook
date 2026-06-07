import { describe, expect, it } from "vitest";
import { buildCustomersHref } from "./customer-url";

describe("buildCustomersHref", () => {
  it("serializes customer search and page state", () => {
    expect(buildCustomersHref({ q: "Ana Vega", page: 2 })).toBe(
      "/customers?q=Ana+Vega&page=2"
    );
  });

  it("omits empty search and first page", () => {
    expect(buildCustomersHref({ q: "", page: 1 })).toBe("/customers");
  });

  it("keeps page when only pagination changes", () => {
    expect(buildCustomersHref({ page: 3 })).toBe("/customers?page=3");
  });
});
