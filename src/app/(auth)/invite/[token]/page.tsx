"use client";

import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle } from "lucide-react";
import { acceptInvitationAction } from "./actions";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [salonName, setSalonName] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      // 1. Server creates the confirmed owner account + the salon atomically.
      const res = await acceptInvitationAction({
        token,
        email,
        password,
        salon_name: salonName,
        full_name: fullName,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      // 2. Sign in client-side (account is already confirmed) and go to the dashboard.
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        // Account + salon were created; just send them to login.
        setDone(true);
        setTimeout(() => router.push("/login"), 1800);
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
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-semibold text-neutral-900">¡Salón creado!</h2>
          <p className="text-neutral-500">Entrando a tu panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">GlowBook</h1>
          <p className="text-sm text-neutral-500 mt-1">Configurar tu salón</p>
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Crea tu salón</h2>
          <p className="text-sm text-neutral-500 mb-6">
            Usa el correo al que recibiste la invitación.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              label="Contraseña"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <Input
              label="Tu nombre completo"
              placeholder="Ana González"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Input
              label="Nombre del salón"
              placeholder="Salón Glamour"
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              required
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={isPending}>
              Crear mi salón
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
