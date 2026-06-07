import { beforeEach, describe, expect, it, vi } from "vitest";
import { findCustomers } from "../data/customers.repo";
import { getCustomersPage } from "./get-customers-page";

vi.mock("../data/customers.repo", () => ({
  findCustomers: vi.fn(),
}));

const mockedFindCustomers = vi.mocked(findCustomers);

describe("get customers page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindCustomers.mockResolvedValue({ data: [], total: 0 });
  });

  it("builds an archived customer view for internal lifecycle screens", async () => {
    mockedFindCustomers.mockResolvedValue({
      data: [
        {
          id: "customer-1",
          salon_id: "salon-1",
          first_name: "Lia",
          last_name: "Mora",
          phone: null,
          email: null,
          notes: null,
          search_name: "lia mora",
          is_active: false,
          is_temporary: false,
          created_at: "2026-05-29T00:00:00.000Z",
          updated_at: "2026-05-29T00:00:00.000Z",
        },
      ],
      total: 42,
    } as never);

    const view = await getCustomersPage({
      salonId: "salon-1",
      q: "lia",
      page: "2",
      status: "archived",
    });

    expect(mockedFindCustomers).toHaveBeenCalledWith("salon-1", {
      q: "lia",
      page: 2,
      perPage: 10,
      isActive: false,
    });
    expect(view.mode).toBe("archived");
    expect(view.isArchived).toBe(true);
    expect(view.totalPages).toBe(5);
  });

  it("defaults invalid pages and unknown status to active mode", async () => {
    const view = await getCustomersPage({
      salonId: "salon-1",
      page: "not-a-number",
      status: "unexpected",
    });

    expect(mockedFindCustomers).toHaveBeenCalledWith("salon-1", {
      q: "",
      page: 1,
      perPage: 10,
      isActive: true,
    });
    expect(view.page).toBe(1);
    expect(view.mode).toBe("active");
  });
});
