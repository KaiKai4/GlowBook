import { describe, expect, it, vi } from "vitest";
import { findSalonIdentity } from "../data/salon-settings.repo";
import { getSalonIdentity } from "./salon-identity";

vi.mock("../data/salon-settings.repo", () => ({
  findSalonIdentity: vi.fn(),
}));

const mockedFindSalonIdentity = vi.mocked(findSalonIdentity);

describe("salón identity", () => {
  it("returns the salón identity through a narrow read Module", async () => {
    mockedFindSalonIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "America/Panama",
      payment_methods: ["cash", "card"],
    });

    await expect(getSalonIdentity("salon-1")).resolves.toEqual({
      name: "Glow Studio",
      timezone: "America/Panama",
      payment_methods: ["cash", "card"],
    });
  });
});
