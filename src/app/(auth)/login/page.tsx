"use client";

import { Suspense, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { GlowBookBrand } from "@/components/brand/glowbook-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AlertCircle, CheckCircle } from "lucide-react";

const EMAIL_EXAMPLE = "ana@salonluna.com";

type FieldErrors = {
  email?: string;
  password?: string;
};

function JoinedBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("joined") !== "1") return null;

  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
      <p className="text-sm text-emerald-700">Cuenta creada. Ingresa con tu correo y contraseña.</p>
    </div>
  );
}

function getEmailError(email: string) {
  if (!email.trim()) return "Escribe el correo con el que entras a GlowBook.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return `Escribe un correo válido, por ejemplo ${EMAIL_EXAMPLE}.`;
  }
  return undefined;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function clearFieldError(field: keyof FieldErrors) {
    setFormError("");
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const nextErrors: FieldErrors = {
      email: getEmailError(email),
      password: password ? undefined : "Escribe tu contraseña.",
    };
    setFieldErrors(nextErrors);

    if (nextErrors.email || nextErrors.password) return;

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setFormError("No pudimos iniciar sesión con esos datos.");
        setFieldErrors({
          email: "Revisa que el correo sea el mismo de tu cuenta.",
          password: "La contraseña no coincide con este correo.",
        });
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fbf8ff_0%,#ffffff_48%,#f8fafc_100%)] px-4 py-10">
      <div className="w-full max-w-[420px]">
        <GlowBookBrand markSize="lg" className="mb-7" />

        <Suspense fallback={null}>
          <JoinedBanner />
        </Suspense>

        <div className="rounded-2xl border border-brand-100 bg-white p-7 shadow-[0_20px_60px_rgba(76,29,149,0.10),0_2px_8px_rgba(15,23,42,0.05)]">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight text-stone-950">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-stone-500">Accede al panel de tu salón.</p>
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
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("password");
              }}
              error={fieldErrors.password}
              required
              autoComplete="current-password"
            />

            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
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
              Iniciar sesión
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
