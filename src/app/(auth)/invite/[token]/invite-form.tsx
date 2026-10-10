"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { GlowBookBrand } from "@/components/brand/glowbook-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AlertCircle, CheckCircle } from "lucide-react";
import { acceptInvitationAction } from "./actions";

const EMAIL_EXAMPLE = "ana@salonluna.com";

type FieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  fullName?: string;
  salonName?: string;
};

function getEmailError(email: string) {
  if (!email.trim()) return "Escribe el correo donde recibiste la invitación.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return `Escribe un correo válido, por ejemplo ${EMAIL_EXAMPLE}.`;
  }
  return undefined;
}

function getPasswordError(password: string) {
  if (!password) return "Crea una contraseña para tu cuenta.";
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return undefined;
}

export function InviteForm() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [salonName, setSalonName] = useState("");
  const [fullName, setFullName] = useState("");
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
      email: getEmailError(email),
      password: getPasswordError(password),
      confirmPassword: !confirmPassword
        ? "Confirma la contraseña antes de crear la cuenta."
        : password !== confirmPassword
          ? "Las contraseñas no coinciden."
          : undefined,
      fullName: fullName.trim() ? undefined : "Escribe tu nombre completo.",
      salonName: salonName.trim() ? undefined : "Escribe el nombre de tu salón.",
    };
    setFieldErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  function assignServerError(message: string) {
    setFormError(message);

    const normalized = message.toLowerCase();
    if (normalized.includes("correo") || normalized.includes("email")) {
      setFieldErrors((current) => ({ ...current, email: message }));
    }
    if (normalized.includes("contraseña") || normalized.includes("password")) {
      setFieldErrors((current) => ({ ...current, password: message }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!validateForm()) return;

    startTransition(async () => {
      const result = await acceptInvitationAction({
        token,
        email: email.trim(),
        password,
        salon_name: salonName.trim(),
        full_name: fullName.trim(),
      });

      if (!result.ok) {
        assignServerError(result.error);
        return;
      }

      setDone(true);

      if (!result.value.signedIn) {
        setTimeout(() => router.push("/login"), 1800);
        return;
      }

      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1200);
    });
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-auth-backdrop px-4">
        <div className="space-y-3 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-success-fg" />
          <h2 className="text-xl font-semibold text-fg-strong">Salón creado</h2>
          <p className="text-fg-subtle">Entrando a tu panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-auth-backdrop px-4 py-10">
      <div className="w-full max-w-[440px]">
        <GlowBookBrand markSize="lg" className="mb-7" />

        <div className="rounded-2xl border border-brand-100 bg-surface p-7 shadow-auth-card">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight text-fg-strong">Crea tu salón</h2>
            <p className="mt-1 text-sm text-fg-subtle">Usa el correo donde recibiste la invitación.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Correo"
              placeholder={EMAIL_EXAMPLE}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("email");
              }}
              error={fieldErrors.email}
              required
              autoComplete="email"
            />
            <PasswordInput
              label="Contraseña"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("password");
                clearFieldError("confirmPassword");
              }}
              error={fieldErrors.password}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <PasswordInput
              label="Confirmar contraseña"
              placeholder="Repite la contraseña"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearFieldError("confirmPassword");
              }}
              error={fieldErrors.confirmPassword}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Input
              label="Tu nombre completo"
              placeholder="Ana González"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                clearFieldError("fullName");
              }}
              error={fieldErrors.fullName}
              required
              autoComplete="name"
            />
            <Input
              label="Nombre del salón"
              placeholder="Salón Luna"
              value={salonName}
              onChange={(e) => {
                setSalonName(e.target.value);
                clearFieldError("salonName");
              }}
              error={fieldErrors.salonName}
              required
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
              className="mt-2 w-full shadow-brand"
              loading={isPending}
            >
              Crear mi salón
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
