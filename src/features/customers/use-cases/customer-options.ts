import "server-only";

import { findCustomers } from "../data/customers.repo";

export interface CustomerOptionView {
  id: string;
  name: string;
}

export async function getActiveCustomerOptions(
  salonId: string,
  perPage = 200
): Promise<CustomerOptionView[]> {
  const customers = await findCustomers(salonId, { perPage, isActive: true });

  return customers.data.map((customer) => ({
    id: customer.id,
    name: `${customer.first_name} ${customer.last_name}`.trim(),
  }));
}
