import "server-only";

import { findCustomers } from "../data/customers.repo";

const PER_PAGE = 10;

export interface GetCustomersPageInput {
  salonId: string;
  q?: string;
  page?: string;
  status?: string;
}

type CustomerPageMode = "active" | "archived";

type CustomerPageItem = Awaited<ReturnType<typeof findCustomers>>["data"][number];

export interface CustomersPageViewModel {
  customers: CustomerPageItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  mode: CustomerPageMode;
  isArchived: boolean;
  query: string;
}

export async function getCustomersPage({
  salonId,
  q,
  page: rawPage,
  status,
}: GetCustomersPageInput): Promise<CustomersPageViewModel> {
  const parsedPage = Number(rawPage ?? 1);
  const page = Number.isSafeInteger(parsedPage) ? Math.max(1, parsedPage) : 1;
  const mode: CustomerPageMode = status === "archived" ? "archived" : "active";
  const isArchived = mode === "archived";
  const query = (q ?? "").trim().slice(0, 100);

  const { data: customers, total } = await findCustomers(salonId, {
    q: query,
    page,
    perPage: PER_PAGE,
    isActive: !isArchived,
  });

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return {
    customers,
    total,
    page,
    pageSize: PER_PAGE,
    totalPages,
    mode,
    isArchived,
    query,
  };
}
