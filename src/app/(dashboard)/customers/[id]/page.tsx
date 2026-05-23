import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findCustomerById } from "@/features/customers/data/customers.repo";
import { updateCustomerAction } from "../actions";
import { CustomerForm } from "../customer-form";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;

  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-400">No tienes permiso para gestionar clientes.</p>
      </div>
    );
  }

  const customer = await findCustomerById(id, profile.salon_id);
  if (!customer) notFound();

  const boundAction = updateCustomerAction.bind(null, customer.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 mt-2">
          {customer.first_name} {customer.last_name}
        </h1>
      </div>
      <CustomerForm
        action={boundAction}
        submitLabel="Guardar cambios"
        defaults={{
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.phone,
          email: customer.email,
          birth_date: customer.birth_date,
          notes: customer.notes,
        }}
      />
    </div>
  );
}
