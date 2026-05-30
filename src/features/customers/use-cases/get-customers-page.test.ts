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

  it("builds an archived customer view with stable pagination links", async () => {
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
      perPage: 20,
      isActive: false,
    });
    expect(view.mode).toBe("archived");
    expect(view.isArchived).toBe(true);
    expect(view.totalPages).toBe(3);
    expect(view.pageHref(3)).toBe("/customers?q=lia&status=archived&page=3");
    expect(view.statusHref("active")).toBe("/customers?q=lia");
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
      perPage: 20,
      isActive: true,
    });
    expect(view.page).toBe(1);
    expect(view.mode).toBe("active");
    expect(view.statusHref("archived")).toBe("/customers?status=archived");
  });
});
