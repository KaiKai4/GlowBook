import {
  Building2,
  CheckCircle2,
  CircleDashed,
  Eye,
  KeyRound,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/session";

const PLATFORM_ROLES = [
  {
    name: "Super admin",
    description: "Acceso completo a plataforma, salones, auditoria y configuracion critica.",
    members: 1,
    tone: "brand",
  },
  {
    name: "Operacion",
    description: "Gestiona salones, invitaciones y estados operativos sin tocar seguridad critica.",
    members: 0,
    tone: "emerald",
  },
  {
    name: "Auditor",
    description: "Consulta eventos, reportes y actividad cross-tenant con permisos de solo lectura.",
    members: 0,
    tone: "stone",
  },
];

const PERMISSION_GROUPS = [
  {
    label: "Plataforma",
    items: ["Dashboard global", "Invitaciones", "Reportes", "Auditoria"],
  },
  {
    label: "Salones",
    items: ["Ver salones", "Suspender salones", "Eliminar tenants", "Configurar modulos"],
  },
  {
    label: "Seguridad",
    items: ["Asignar roles", "Revisar permisos", "Ver logs criticos"],
  },
];

const ROLE_MATRIX = [
  { permission: "Ver panel global", superAdmin: true, operation: true, auditor: true },
  { permission: "Invitar salones", superAdmin: true, operation: true, auditor: false },
  { permission: "Suspender salones", superAdmin: true, operation: true, auditor: false },
  { permission: "Eliminar tenants", superAdmin: true, operation: false, auditor: false },
  { permission: "Ver auditoria", superAdmin: true, operation: false, auditor: true },
  { permission: "Administrar roles", superAdmin: true, operation: false, auditor: false },
];

export default async function PlatformRolesPage() {
  await requirePlatformAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Control de acceso de plataforma
          </div>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-950">
            <UserCog className="h-6 w-6 text-brand-600" />
            Roles
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
            Gestion centralizada de roles administrativos. Este apartado separa la seguridad
            de plataforma de la gestion operativa de salones.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Estado
          </p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">Distribucion inicial</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PlatformMetric
          icon={<ShieldCheck className="h-5 w-5 text-brand-600" />}
          label="Roles base"
          value={PLATFORM_ROLES.length}
        />
        <PlatformMetric
          icon={<KeyRound className="h-5 w-5 text-emerald-600" />}
          label="Permisos agrupados"
          value={PERMISSION_GROUPS.length}
        />
        <PlatformMetric
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
          label="Fuera de salones"
          value="Si"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-neutral-100 bg-white pb-5">
            <CardTitle>Roles de plataforma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PLATFORM_ROLES.map((role) => (
              <div
                key={role.name}
                className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-950">{role.name}</p>
                    <p className="mt-1 text-sm leading-5 text-neutral-500">{role.description}</p>
                  </div>
                  <Badge variant={role.members > 0 ? "success" : "default"}>
                    {role.members} usuario{role.members === 1 ? "" : "s"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-neutral-100 bg-white pb-5">
            <CardTitle>Matriz de permisos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    <th className="px-3 py-3">Permiso</th>
                    <th className="px-3 py-3 text-center">Super admin</th>
                    <th className="px-3 py-3 text-center">Operacion</th>
                    <th className="px-3 py-3 text-center">Auditor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {ROLE_MATRIX.map((row) => (
                    <tr key={row.permission}>
                      <td className="px-3 py-3 font-medium text-neutral-800">{row.permission}</td>
                      <PermissionCell enabled={row.superAdmin} />
                      <PermissionCell enabled={row.operation} />
                      <PermissionCell enabled={row.auditor} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-neutral-100 bg-white pb-5">
          <CardTitle>Grupos de permisos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            {PERMISSION_GROUPS.map((group) => (
              <div
                key={group.label}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-neutral-950">{group.label}</p>
                <ul className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-neutral-600">
                      <Eye className="h-3.5 w-3.5 text-neutral-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlatformMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-neutral-950">{value}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionCell({ enabled }: { enabled: boolean }) {
  return (
    <td className="px-3 py-3 text-center">
      {enabled ? (
        <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" aria-label="Permitido" />
      ) : (
        <CircleDashed className="mx-auto h-4 w-4 text-neutral-300" aria-label="Sin permiso" />
      )}
    </td>
  );
}
