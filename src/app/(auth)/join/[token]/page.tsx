import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { JoinForm } from "./join-form";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createSupabaseAdminClient();

  // Use admin client to bypass RLS — invitation lookup must work without a session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (admin as any)
    .from("employee_invitations")
    .select(`
      id, email, expires_at, accepted_at,
      employees(first_name, last_name),
      salons(name)
    `)
    .eq("token", token)
    .single();

  if (!inv) notFound();

  const employee = inv.employees as { first_name: string; last_name: string } | null;
  const salon = inv.salons as { name: string } | null;

  if (inv.accepted_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-stone-900">Enlace ya utilizado</p>
          <p className="mt-2 text-sm text-stone-500">
            Esta invitación ya fue aceptada. Si tienes problemas para acceder, contacta al administrador del salón.
          </p>
        </div>
      </div>
    );
  }

  if (new Date(inv.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-stone-900">Enlace expirado</p>
          <p className="mt-2 text-sm text-stone-500">
            Este enlace de invitación ha vencido. Solicita uno nuevo al administrador del salón.
          </p>
        </div>
      </div>
    );
  }

  return (
    <JoinForm
      token={token}
      email={inv.email}
      employeeName={employee ? `${employee.first_name} ${employee.last_name}` : "Colaborador"}
      salonName={salon?.name ?? "tu salón"}
    />
  );
}
