"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmployeeCreateForm } from "./employee-create-form";
import { EmployeeInviteLinkCard } from "./employee-invite-link-card";
import type { CategoryOption, RoleOption } from "./types";
import type { CreateEmployeeResult } from "@/features/employees/use-cases/employee-profile";

interface EmployeeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryOption[];
  roles: RoleOption[];
}

export function EmployeeCreateDialog({
  open,
  onOpenChange,
  categories,
  roles,
}: EmployeeCreateDialogProps) {
  const [inviteResult, setInviteResult] = useState<CreateEmployeeResult | null>(null);

  const inviteUrl = inviteResult?.inviteToken
    ? (typeof window !== "undefined" ? `${window.location.origin}/join/${inviteResult.inviteToken}` : "")
    : "";

  function closeDialog() {
    onOpenChange(false);
    setInviteResult(null);
  }

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      title={inviteResult ? "Colaborador creado" : "Nuevo colaborador"}
      description={inviteResult ? undefined : "Elige las categorías y los servicios que realiza."}
      className="max-w-lg"
    >
      {inviteResult ? (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 pt-2 pb-1 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-sm text-stone-600">
              El colaborador fue registrado. Copia el enlace de acceso y envialo por WhatsApp o correo.
            </p>
          </div>

          <EmployeeInviteLinkCard
            url={inviteUrl}
            title="Enlace de acceso valido 7 días"
            description="El colaborador abrira este link para crear su contrasena y acceder al sistema."
          />

          <Button variant="primary" className="w-full" onClick={closeDialog}>
            Listo
          </Button>
        </div>
      ) : (
        <EmployeeCreateForm
          categories={categories}
          roles={roles}
          onCreated={closeDialog}
          onCreatedWithInvite={setInviteResult}
        />
      )}
    </Dialog>
  );
}
