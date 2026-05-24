"use client";

import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justJoined = searchParams.get("joined") === "1";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("Email o contraseña incorrectos.");
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">GlowBook</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestión inteligente para tu salón</p>
        </div>

        {justJoined && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-sm text-emerald-700">¡Cuenta creada! Ingresa con tu email y contraseña.</p>
          </div>
        )}

        <div className="rounded-2xl border border-neutral-100 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={isPending}
            >
              Iniciar sesión
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-neutral-400">
            ¿Nuevo salón?{" "}
            <span className="text-neutral-600">
              Solicita una invitación a la plataforma.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
