"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, MailOpen } from "lucide-react";

import { GlowBookBrand } from "@/components/brand/glowbook-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction } from "./actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Escribe el correo de tu cuenta.");
      return;
    }

    startTransition(async () => {
      const result = await requestPasswordResetAction(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Siempre mostramos exito: no revelamos si el correo existe o no.
      setSent(true);
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-auth-backdrop px-4 py-10">
      <div className="w-full max-w-[420px]">
        <GlowBookBrand markSize="lg" className="mb-7" />

        <div className="rounded-2xl border border-brand-100 bg-surface p-7 shadow-auth-card">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-subtle">
                <CheckCircle className="h-7 w-7 text-success" />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-fg-strong">
                Revisa tu correo
              </h2>
              <p className="mt-2 text-sm leading-6 text-fg-subtle">
                Si <span className="font-medium text-fg-secondary">{email.trim()}</span> tiene una
                cuenta en GlowBook, te enviamos un enlace para crear una contraseña nueva.
                Puede tardar unos minutos; revisa tambien el spam.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a iniciar sesion
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                  <MailOpen className="h-5 w-5 text-brand-600" />
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-fg-strong">
                  ¿Olvidaste tu contraseña?
                </h2>
                <p className="mt-1 text-sm leading-6 text-fg-subtle">
                  Escribe el correo con el que entras a GlowBook y te enviaremos un enlace
                  para crear una contraseña nueva.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="email"
                  label="Correo"
                  placeholder="ana@salonluna.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  error={error || undefined}
                  required
                  autoComplete="email"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  loading={isPending}
                >
                  Enviar enlace
                </Button>
              </form>

              <Link
                href="/login"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-fg-subtle hover:text-fg-secondary"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a iniciar sesion
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
