import { Suspense } from "react";

import { GlowBookBrand } from "@/components/brand/glowbook-logo";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-auth-backdrop px-4 py-10">
      <div className="w-full max-w-[420px]">
        <GlowBookBrand markSize="lg" className="mb-7" />
        <div className="rounded-2xl border border-brand-100 bg-surface p-7 shadow-auth-card">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
