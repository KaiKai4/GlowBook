"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, KeyRound } from "lucide-react";

import { createSupabaseBrowserClient } from "@/infra/supabase/client";
import { GlowBookBrand } from "@/components/brand/glowbook-logo";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

type LinkState = "verifying" | "ready" | "invalid";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [linkState, setLinkState] = useState<LinkState>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");

    async function verifyLink() {
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        setLinkState(exchangeError ? "invalid" : "ready");
        return;
      }
      if (tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        setLinkState(otpError ? "invalid" : "ready");
        return;
      }
      // Sin parametros: puede venir de una sesion de recuperacion ya abierta.
      const { data } = await supabase.auth.getUser();
      setLinkState(data.user ? "ready" : "invalid");
    }

    void verifyLink();
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("No se pudo actualizar la contraseña. Pide un enlace nuevo e intentalo otra vez.");
        return;
      }
      // Cerramos la sesion de recuperacion para que entre con la nueva clave.
      await supabase.auth.signOut();
      router.push("/login?reset=1");
    });
  }

  if (linkState === "verifying") {
    return <p className="py-8 text-center text-sm text-fg-subtle">Verificando el enlace...</p>;
  }

  if (linkState === "invalid") {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-subtle">
          <AlertCircle className="h-7 w-7 text-danger" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-fg-strong">
          Enlace inválido o vencido
        </h2>
        <p className="mt-2 text-sm leading-6 text-fg-subtle">
          Los enlaces de recuperacion vencen rapido por seguridad. Solicita uno nuevo.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
        >
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
          <KeyRound className="h-5 w-5 text-brand-600" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-fg-strong">
          Crea tu nueva contraseña
        </h2>
        <p className="mt-1 text-sm text-fg-subtle">
          Minimo 8 caracteres. La usaras la próxima vez que inicies sesion.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          label="Nueva contraseña"
          placeholder="Tu nueva contraseña"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          required
          autoComplete="new-password"
        />
        <PasswordInput
          label="Confirmar contraseña"
          placeholder="Repite la contraseña"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError("");
          }}
          required
          autoComplete="new-password"
        />

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger-border-subtle bg-danger-subtle px-3 py-2.5 text-sm text-danger-strong">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isPending}>
          Guardar contraseña
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fbf8ff_0%,#ffffff_48%,#f8fafc_100%)] px-4 py-10">
      <div className="w-full max-w-[420px]">
        <GlowBookBrand markSize="lg" className="mb-7" />
        <div className="rounded-2xl border border-brand-100 bg-surface p-7 shadow-[0_20px_60px_rgba(76,29,149,0.10),0_2px_8px_rgba(15,23,42,0.05)]">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
