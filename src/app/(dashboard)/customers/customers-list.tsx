"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Phone, Mail } from "lucide-react";
import { EditCustomerModal } from "./edit-customer-modal";
import { reactivateCustomerAction } from "./actions";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_temporary: boolean;
}

export function CustomersList({ customers, mode }: { customers: Customer[]; mode: "active" | "archived" }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [reactivationError, setReactivationError] = useState<string | null>(null);
  const isArchived = mode === "archived";

  if (customers.length === 0) return null;

  async function reactivate(customerId: string) {
    setReactivationError(null);
    setReactivatingId(customerId);
    const result = await reactivateCustomerAction(customerId);
    setReactivatingId(null);
    if (result.ok) router.refresh();
    else setReactivationError(result.error ?? "No se pudo reactivar el cliente.");
  }

  const columns: DataTableColumn<Customer>[] = [
    {
      id: "customer",
      header: "Cliente",
      cell: (customer) => (
        <p className="font-medium text-fg">
          {customer.first_name} {customer.last_name}
          {customer.is_temporary && (
            <Badge variant="warning" className="ml-2">Temporal</Badge>
          )}
        </p>
      ),
    },
    {
      id: "phone",
      header: "Teléfono",
      secondary: true,
      cell: (customer) =>
        customer.phone ? (
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {customer.phone}
          </span>
        ) : null,
    },
    {
      id: "email",
      header: "Correo",
      secondary: true,
      cell: (customer) =>
        customer.email ? (
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {customer.email}
          </span>
        ) : null,
    },
    {
      id: "actions",
      header: "Acciones",
      align: "right",
      cell: (customer) =>
        isArchived ? (
          <Button
            variant="primary"
            className="h-auto shrink-0 px-3 py-1.5 text-xs"
            loading={reactivatingId === customer.id}
            onClick={() => reactivate(customer.id)}
          >
            Reactivar
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="h-auto shrink-0 px-2 py-1 text-xs text-accent-strong hover:underline"
            onClick={() => setEditing(customer)}
          >
            Editar
          </Button>
        ),
    },
  ];

  return (
    <>
      {reactivationError && (
        <div className="mb-3 rounded-lg border border-danger-border bg-danger-subtle px-3 py-2.5 text-sm text-danger-strong">
          {reactivationError}
        </div>
      )}
      <DataTable
        label={isArchived ? "Clientes archivados" : "Clientes"}
        columns={columns}
        rows={customers}
        getRowId={(customer) => customer.id}
        emptyMessage="Aún no hay clientes."
      />

      {editing && (
        <EditCustomerModal
          customer={editing}
          open={true}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
