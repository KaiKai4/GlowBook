// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCustomersPage, type CustomersPageViewModel } from "@/features/customers/use-cases/get-customers-page";
import { hasPermission } from "@/lib/auth/permissions";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import CustomersPage from "./page";
import { CustomersClient } from "./customers-client";

vi.mock("@/lib/auth/session", () => ({
  requireProfile: vi.fn(async () => ({ id: "user-1", salon_id: "salon-1" })),
}));

vi.mock("@/lib/auth/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/permissions")>()),
  hasPermission: vi.fn(),
}));

vi.mock("@/features/customers/use-cases/get-customers-page", () => ({
  getCustomersPage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("./actions", () => ({
  createCustomerAction: vi.fn(),
  checkCustomerPhoneAction: vi.fn(),
  findArchivedCustomerByContactAction: vi.fn(),
  reactivateCustomerAction: vi.fn(),
  updateCustomerAction: vi.fn(),
  deleteCustomerAction: vi.fn(),
}));

const VIEW: CustomersPageViewModel = {
  customers: [],
  total: 0,
  page: 2,
  pageSize: 10,
  totalPages: 2,
  mode: "active",
  isArchived: false,
  query: "ana",
};

describe("CustomersPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(hasPermission).mockReset();
    vi.mocked(getCustomersPage).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega el acceso sin consultar clientes cuando el usuario no tiene permiso", async () => {
    vi.mocked(hasPermission).mockReturnValue(false);

    mounted = mountComponent(await CustomersPage({ searchParams: Promise.resolve({}) }));

    expect(mounted.container.textContent).toContain("No tienes permiso para ver clientes.");
    expect(getCustomersPage).not.toHaveBeenCalled();
  });

  it("consulta la página con la búsqueda y el número de página de la URL", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getCustomersPage).mockResolvedValue(VIEW);

    const element = await CustomersPage({ searchParams: Promise.resolve({ q: "ana", page: "2" }) });

    expect(getCustomersPage).toHaveBeenCalledWith({
      salonId: "salon-1",
      q: "ana",
      page: "2",
      status: "active",
    });
    expect(element.type).toBe(CustomersClient);
    expect(element.props).toEqual({ initialView: VIEW });
  });

  it("reinicia el cliente cuando cambian la búsqueda o la página", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getCustomersPage).mockResolvedValue(VIEW);

    const element = await CustomersPage({ searchParams: Promise.resolve({}) });

    expect(element.key).toBe("ana:2");
  });
});
