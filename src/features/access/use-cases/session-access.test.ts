import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSalonAccessState, findSessionProfile } from "../data/session-profile.repo";
import { loadSalonAccessState, loadSessionProfile } from "./session-access";

vi.mock("server-only", () => ({}));
vi.mock("../data/session-profile.repo", () => ({
  findSalonAccessState: vi.fn(),
  findSessionProfile: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("session-access", () => {
  it("loadSessionProfile delega en el repositorio con el id del usuario", async () => {
    vi.mocked(findSessionProfile).mockResolvedValue(null);

    await expect(loadSessionProfile("user-1")).resolves.toBeNull();
    expect(findSessionProfile).toHaveBeenCalledWith("user-1");
  });

  it("loadSalonAccessState delega en el repositorio con el id del salón", async () => {
    vi.mocked(findSalonAccessState).mockResolvedValue({ id: "salon-1", is_active: false });

    await expect(loadSalonAccessState("salon-1")).resolves.toEqual({ id: "salon-1", is_active: false });
    expect(findSalonAccessState).toHaveBeenCalledWith("salon-1");
  });
});
