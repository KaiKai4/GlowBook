import { notFound } from "next/navigation";
import { getEmployeeInvitationJoinView } from "@/features/employees";
import { JoinForm } from "./join-form";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getEmployeeInvitationJoinView(token);

  if (invitation.status === "not_found") notFound();

  if (invitation.status === "accepted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-fg">Enlace ya utilizado</p>
          <p className="mt-2 text-sm text-fg-subtle">
            Esta invitacion ya fue aceptada. Si tienes problemas para acceder, contacta al administrador del salon.
          </p>
        </div>
      </div>
    );
  }

  if (invitation.status === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-fg">Enlace expirado</p>
          <p className="mt-2 text-sm text-fg-subtle">
            Este enlace de invitacion ha vencido. Solicita uno nuevo al administrador del salon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <JoinForm
      token={token}
      email={invitation.email}
      employeeName={invitation.employeeName}
      salonName={invitation.salonName}
    />
  );
}
