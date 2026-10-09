"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { rememberSessionInBrowser } from "@/lib/supabase/session-persistence";
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
  const message =
    searchParams.get("joined") === "1"
      ? "Cuenta creada. Ingresa con tu correo y contraseña."
      : searchParams.get("reset") === "1"
        ? "Contraseña actualizada. Ingresa con tu nueva contraseña."
        : null;
  if (!message) return null;

  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-success-border-subtle bg-success-subtle px-4 py-3">
      <CheckCircle className="h-4 w-4 shrink-0 text-success-fg" />
      <p className="text-sm text-success-fg">{message}</p>
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
  const [remember, setRemember] = useState(true);
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
      // El marcador debe existir antes de que el sign-in escriba las cookies
      // de auth, para que nazcan ya con la persistencia correcta.
      rememberSessionInBrowser(remember);
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
    <div className="flex min-h-screen items-center justify-center bg-auth-backdrop px-4 py-10">
      <div className="w-full max-w-[420px]">
        <GlowBookBrand markSize="lg" className="mb-7" />

        <Suspense fallback={null}>
          <JoinedBanner />
        </Suspense>

        <div className="rounded-2xl border border-brand-100 bg-surface p-7 shadow-auth-card">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight text-fg-strong">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-fg-subtle">Accede al panel de tu salón.</p>
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

            <div className="flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
                />
                Mantener sesión iniciada
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

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
              Iniciar sesión
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
