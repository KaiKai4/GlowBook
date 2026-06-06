import "server-only";

import { findCustomers } from "../data/customers.repo";

const PER_PAGE = 20;

export interface GetCustomersPageInput {
  salonId: string;
  q?: string;
  page?: string;
  status?: string;
}

export type CustomerPageMode = "active" | "archived";

export type CustomerPageItem = Awaited<ReturnType<typeof findCustomers>>["data"][number];

export interface CustomersPageViewModel {
  customers: CustomerPageItem[];
  total: number;
  page: number;
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
  const page = Math.max(1, Number(rawPage ?? 1) || 1);
  const mode: CustomerPageMode = status === "archived" ? "archived" : "active";
  const isArchived = mode === "archived";
  const query = q ?? "";

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
    totalPages,
    mode,
    isArchived,
    query,
  };
}
