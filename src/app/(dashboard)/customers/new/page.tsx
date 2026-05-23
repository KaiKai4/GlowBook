import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createCustomerAction } from "../actions";
import { CustomerForm } from "../customer-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewCustomerPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-400">No tienes permiso para gestionar clientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 mt-2">Nuevo cliente</h1>
      </div>
      <CustomerForm action={createCustomerAction} submitLabel="Crear cliente" />
    </div>
  );
}
