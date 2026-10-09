"use client";

import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/infra/supabase/client";
import { useRouter } from "next/navigation";
import { GlowBookBrand } from "@/components/brand/glowbook-logo";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { AlertCircle, CheckCircle } from "lucide-react";
import { acceptEmployeeInvitationAction } from "./actions";

interface Props {
  token: string;
  email: string;
  employeeName: string;
  salonName: string;
}

type FieldErrors = {
  password?: string;
  confirm?: string;
};

function getPasswordError(password: string) {
  if (!password) return "Crea una contraseña para tu cuenta.";
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return undefined;
}

export function JoinForm({ token, email, employeeName, salonName }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function clearFieldError(field: keyof FieldErrors) {
    setFormError("");
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateForm() {
    const nextErrors: FieldErrors = {
      password: getPasswordError(password),
      confirm: !confirm
        ? "Confirma la contraseña antes de crear la cuenta."
        : password !== confirm
          ? "Las contraseñas no coinciden."
          : undefined,
    };
    setFieldErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!validateForm()) return;

    startTransition(async () => {
      const res = await acceptEmployeeInvitationAction(token, password);

      if (res && !res.ok) {
        const message = res.error;
        setFormError(message);
        if (message.toLowerCase().includes("contraseña") || message.toLowerCase().includes("password")) {
          setFieldErrors((current) => ({ ...current, password: message }));
        }
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setDone(true);
        setTimeout(() => router.push("/login"), 2000);
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1200);
    });
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fbf8ff_0%,#ffffff_48%,#f8fafc_100%)] px-4">
        <div className="space-y-3 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-success-fg" />
          <h2 className="text-xl font-semibold text-fg-strong">Cuenta creada</h2>
          <p className="text-fg-subtle">Entrando al panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fbf8ff_0%,#ffffff_48%,#f8fafc_100%)] px-4 py-10">
      <div className="w-full max-w-[420px]">
        <GlowBookBrand markSize="lg" className="mb-7" />

        <div className="rounded-2xl border border-brand-100 bg-surface p-7 shadow-[0_20px_60px_rgba(76,29,149,0.10),0_2px_8px_rgba(15,23,42,0.05)]">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight text-fg-strong">Hola, {employeeName}</h2>
            <p className="mt-1 text-sm text-fg-subtle">Crea una contraseña para acceder a {salonName}.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2.5">
              <p className="text-xs font-semibold text-brand-500">Correo de invitación</p>
              <p className="mt-0.5 truncate text-sm font-medium text-fg-secondary">{email}</p>
            </div>

            <PasswordInput
              label="Contraseña"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("password");
                clearFieldError("confirm");
              }}
              error={fieldErrors.password}
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
            />
            <PasswordInput
              label="Confirmar contraseña"
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                clearFieldError("confirm");
              }}
              error={fieldErrors.confirm}
              required
              minLength={8}
              autoComplete="new-password"
            />

            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-danger-border-subtle bg-danger-subtle px-3 py-2.5 text-sm text-danger-strong">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{formError}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-2 w-full shadow-[0_10px_24px_rgba(124,58,237,0.28)]"
              loading={isPending}
            >
              Crear mi cuenta
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
