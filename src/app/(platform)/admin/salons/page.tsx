import Link from "next/link";
import { ArrowLeft, Building2, CalendarDays, Users } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { findSalonOverviews } from "@/features/platform/data/platform.repo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteSalonButton } from "./delete-salon-button";

export default async function PlatformSalonsPage() {
  await requirePlatformAdmin();
  const salons = await findSalonOverviews();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-neutral-900">Salones</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Información global de salones registrados y eliminación completa de tenants.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={<Building2 className="h-5 w-5 text-blue-600" />} label="Total salones" value={salons.length} />
        <MetricCard icon={<Users className="h-5 w-5 text-emerald-600" />} label="Activos" value={salons.filter((s) => s.is_active).length} />
        <MetricCard icon={<CalendarDays className="h-5 w-5 text-brand-600" />} label="Citas totales" value={salons.reduce((sum, salon) => sum + salon.appointment_count, 0)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salones registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {salons.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">No hay salones registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    <th className="px-3 py-3">Salón</th>
                    <th className="px-3 py-3">Owners</th>
                    <th className="px-3 py-3">Datos</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Creado</th>
                    <th className="px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {salons.map((salon) => (
                    <tr key={salon.id} className="align-top">
                      <td className="px-3 py-4">
                        <p className="font-semibold text-neutral-900">{salon.name}</p>
                        <p className="text-xs text-neutral-500">{salon.email || "Sin email"}</p>
                        <p className="text-xs text-neutral-400">{salon.phone || "Sin teléfono"}</p>
                        <p className="mt-1 font-mono text-[11px] text-neutral-400">{salon.id}</p>
                      </td>
                      <td className="px-3 py-4">
                        {salon.owner_names.length > 0 ? (
                          <div className="space-y-1">
                            {salon.owner_names.map((owner) => (
                              <p key={owner} className="text-xs font-medium text-neutral-700">{owner}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-neutral-400">Sin owner</p>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600">
                          <MiniStat label="Clientes" value={salon.customer_count} />
                          <MiniStat label="Colaboradores" value={salon.collaborator_count} />
                          <MiniStat label="Citas" value={salon.appointment_count} />
                          <MiniStat label="Servicios" value={salon.service_count} />
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant={salon.is_active ? "success" : "danger"}>
                          {salon.is_active ? "Activo" : "Suspendido"}
                        </Badge>
                      </td>
                      <td className="px-3 py-4 text-xs text-neutral-500">
                        {new Date(salon.created_at).toLocaleDateString("es-PA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-4 text-right">
                        <DeleteSalonButton salonId={salon.id} salonName={salon.name} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-neutral-900">{value}</p>
          </div>
          <div className="rounded-lg bg-neutral-50 p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-1.5">
      <p className="text-[11px] text-neutral-400">{label}</p>
      <p className="font-semibold text-neutral-800">{value}</p>
    </div>
  );
}
