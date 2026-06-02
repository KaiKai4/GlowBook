"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <>
      {reactivationError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
          {reactivationError}
        </div>
      )}
      {customers.map((customer) => (
        <Card key={customer.id} className="hover:shadow-sm transition-shadow">
          <CardContent className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">
                  {customer.first_name} {customer.last_name}
                  {customer.is_temporary && (
                    <Badge variant="warning" className="ml-2">Temporal</Badge>
                  )}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  {customer.phone && (
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Phone className="h-3 w-3" />
                      {customer.phone}
                    </span>
                  )}
                  {customer.email && (
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Mail className="h-3 w-3" />
                      {customer.email}
                    </span>
                  )}
                </div>
              </div>
              {isArchived ? (
                <Button
                  variant="primary"
                  className="text-xs shrink-0 h-auto px-3 py-1.5"
                  loading={reactivatingId === customer.id}
                  onClick={async () => {
                    setReactivationError(null);
                    setReactivatingId(customer.id);
                    const res = await reactivateCustomerAction(customer.id);
                    setReactivatingId(null);
                    if (res.ok) router.refresh();
                    else setReactivationError(res.error ?? "No se pudo reactivar el cliente.");
                  }}
                >
                  Reactivar
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="text-xs text-rose-600 hover:underline shrink-0 h-auto px-2 py-1"
                  onClick={() => setEditing(customer)}
                >
                  Editar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

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
