"use client";

import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle } from "lucide-react";
import { acceptEmployeeInvitationAction } from "./actions";

interface Props {
  token: string;
  email: string;
  employeeName: string;
  salonName: string;
}

export function JoinForm({ token, email, employeeName, salonName }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    startTransition(async () => {
      const res = await acceptEmployeeInvitationAction(token, password);

      if (res && !res.ok) {
        setError(res.error);
        return;
      }

      // Server action redirects on success, but if it returns early, sign in client-side
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
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-semibold text-stone-900">¡Cuenta creada!</h2>
          <p className="text-stone-500">Entrando al panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">GlowBook</h1>
          <p className="text-sm text-stone-500 mt-1">{salonName}</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900 mb-1">Hola, {employeeName}</h2>
          <p className="text-sm text-stone-500 mb-6">
            Crea una contraseña para acceder al sistema.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-xs font-medium text-stone-500 mb-1">Email</p>
              <p className="text-sm font-medium text-stone-700">{email}</p>
            </div>

            <Input
              type="password"
              label="Contraseña"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
            />
            <Input
              type="password"
              label="Confirmar contraseña"
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={isPending}>
              Crear mi cuenta
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
