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
  pageHref: (page: number) => string;
  statusHref: (status: CustomerPageMode) => string;
}

function searchParamsFor({
  q,
  page,
  status,
}: {
  q?: string;
  page?: number;
  status?: CustomerPageMode;
}): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status === "archived") params.set("status", "archived");
  if (page !== undefined) params.set("page", String(page));
  return params.toString();
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
    pageHref: (nextPage) => {
      const params = searchParamsFor({ q: query, page: nextPage, status: mode });
      return `/customers?${params}`;
    },
    statusHref: (nextStatus) => {
      const params = searchParamsFor({ q: query, status: nextStatus });
      return `/customers${params ? `?${params}` : ""}`;
    },
  };
}
