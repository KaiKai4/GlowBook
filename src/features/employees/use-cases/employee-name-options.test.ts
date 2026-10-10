import { describe, expect, it, vi } from "vitest";
import { findActiveEmployeeNames } from "../data/employees-read.repo";
import { getActiveEmployeeNameOptions } from "./employee-name-options";

vi.mock("../data/employees-read.repo", () => ({
  findActiveEmployeeNames: vi.fn(),
}));

const mockedFindActiveEmployeeNames = vi.mocked(findActiveEmployeeNames);

describe("employee name options", () => {
  it("maps active employees to name options", async () => {
    mockedFindActiveEmployeeNames.mockResolvedValue([
      { id: "employee-1", first_name: "Ana", last_name: "Vega" },
    ]);

    await expect(getActiveEmployeeNameOptions("salon-1")).resolves.toEqual([
      { id: "employee-1", name: "Ana Vega" },
    ]);
  });
});
