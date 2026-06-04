import { describe, expect, it, vi } from "vitest";
import { findSalonIdentity } from "../data/salon.repo";
import { getSalonIdentity } from "./salon-identity";

vi.mock("../data/salon.repo", () => ({
  findSalonIdentity: vi.fn(),
}));

const mockedFindSalonIdentity = vi.mocked(findSalonIdentity);

describe("salon identity", () => {
  it("returns the salon identity through a narrow read Module", async () => {
    mockedFindSalonIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "America/Panama",
    });

    await expect(getSalonIdentity("salon-1")).resolves.toEqual({
      name: "Glow Studio",
      timezone: "America/Panama",
    });
  });
});
