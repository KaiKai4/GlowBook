"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import {
  Plus, ChevronRight, Users, Search, Filter,
  Copy, Check, Link2, CheckCircle, ShieldCheck,
} from "lucide-react";
import {
  createEmployeeAction,
  findArchivedEmployeeByEmailAction,
  reactivateEmployeeAction,
  type ArchivedEmployeeMatch,
  type CreateEmployeeResult,
} from "./actions";
import type { Result } from "@/lib/result";

interface EmployeeListItem {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  profile_id: string | null;
  serviceCount: number;
  categories: string[];
  categoryIds: string[];
}
interface CategoryOption {
  id: string;
  name: string;
  services: { id: string; name: string }[];
}
interface RoleOption { id: string; name: string }

export function EmployeesManager({
  employees,
  categories,
  roles,
  mode,
}: {
  employees: EmployeeListItem[];
  categories: CategoryOption[];
  roles: RoleOption[];
  mode: "active" | "archived";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reactivationPending, startReactivation] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [inviteResult, setInviteResult] = useState<CreateEmployeeResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [archivedMatch, setArchivedMatch] = useState<ArchivedEmployeeMatch | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterCatId, setFilterCatId] = useState<string | null>(null);
  const isArchived = mode === "archived";

  function reset() {
    setSelectedCats([]);
    setError(null);
    setInviteResult(null);
    setCopied(false);
    setEmail("");
    setArchivedMatch(null);
  }

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res: Result<CreateEmployeeResult> = await createEmployeeAction(null, formData);
      if (res.ok) {
        if (res.value.inviteToken) {
          setInviteResult(res.value);
        } else {
          setOpen(false);
          reset();
        }
      } else {
        setError(res.error);
      }
    });
  }

  async function handleCopyLink() {
    if (!inviteResult?.inviteToken) return;
    const url = `${window.location.origin}/join/${inviteResult.inviteToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleCloseSuccess() {
    setOpen(false);
    reset();
  }

  function toggleCat(id: string) {
    setSelectedCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const selectedCategoryObjs = categories.filter((c) => selectedCats.includes(c.id));

  const filtered = useMemo(() => employees.filter((emp) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      emp.first_name.toLowerCase().includes(q) ||
      emp.last_name.toLowerCase().includes(q) ||
      emp.categories.some((c) => c.toLowerCase().includes(q));
    const matchCat = !filterCatId || emp.categoryIds.includes(filterCatId);
    return matchSearch && matchCat;
  }), [employees, search, filterCatId]);

  const inviteUrl = inviteResult?.inviteToken
    ? (typeof window !== "undefined" ? `${window.location.origin}/join/${inviteResult.inviteToken}` : "")
    : "";

  async function checkArchivedEmail(nextEmail = email) {
    const match = await findArchivedEmployeeByEmailAction(nextEmail);
    setArchivedMatch(match);
  }

  function handleReactivateEmployee(employeeId: string) {
    setReactivatingId(employeeId);
    startReactivation(async () => {
      const res = await reactivateEmployeeAction(employeeId);
      setReactivatingId(null);
      if (res.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        window.alert(res.error ?? "No se pudo reactivar el colaborador.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Colaboradores</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            {filtered.length} de {employees.length} colaboradores {isArchived ? "archivados" : "activos"}
          </p>
        </div>
        {!isArchived && (
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo colaborador
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Link
          href="/employees"
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            !isArchived
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : "border-stone-200 text-stone-500 hover:bg-stone-50"
          )}
        >
          Activos
        </Link>
        <Link
          href="/employees?status=archived"
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            isArchived
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : "border-stone-200 text-stone-500 hover:bg-stone-50"
          )}
        >
          Archivados
        </Link>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs font-medium text-stone-400">
            <Filter className="h-3.5 w-3.5" /> Categoría:
          </span>
          <button
            onClick={() => setFilterCatId(null)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              !filterCatId
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
            )}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCatId(filterCatId === cat.id ? null : cat.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filterCatId === cat.id
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Employee grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-200 bg-white py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
            <Users className="h-5 w-5 text-brand-400" />
          </div>
          <p className="mt-3 text-sm font-medium text-stone-500">
            {employees.length === 0 ? "Aún no hay colaboradores." : "No hay coincidencias."}
          </p>
          {(search || filterCatId) ? (
            <button
              onClick={() => { setSearch(""); setFilterCatId(null); }}
              className="mt-2 text-xs text-brand-600 hover:underline"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((emp) => {
            const card = (
              <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_16px_rgba(124,58,237,0.12)] hover:-translate-y-0.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-choco-100 text-sm font-bold text-brand-700">
                  {`${emp.first_name[0] ?? ""}${emp.last_name[0] ?? ""}`.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-stone-900">
                      {emp.first_name} {emp.last_name}
                    </p>
                    {!emp.is_active && <Badge variant="default" className="ml-1">Inactivo</Badge>}
                  </div>
                  <p className="truncate text-xs text-stone-400">
                    {emp.categories.length > 0 ? emp.categories.join(" · ") : "Sin categorías"}
                  </p>
                  <p className="mt-0.5 text-xs text-brand-500 font-medium">{emp.serviceCount} servicios</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {isArchived ? (
                    <Button
                      variant="primary"
                      className="h-8 px-3 text-xs"
                      loading={reactivatingId === emp.id}
                      disabled={reactivationPending}
                      onClick={() => handleReactivateEmployee(emp.id)}
                    >
                      Reactivar
                    </Button>
                  ) : (
                    <>
                      {emp.profile_id ? (
                        <span title="Con acceso al sistema"><ShieldCheck className="h-4 w-4 text-emerald-500" /></span>
                      ) : (
                        <span title="Sin acceso al sistema"><Link2 className="h-4 w-4 text-stone-300" /></span>
                      )}
                      <ChevronRight className="h-4 w-4 text-stone-300 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </div>
              </div>
            );

            return isArchived ? (
              <div key={emp.id} className="group">
                {card}
              </div>
            ) : (
              <Link key={emp.id} href={`/employees/${emp.id}`} className="group">
                {card}
              </Link>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={open}
        onClose={() => { if (!pending) { setOpen(false); reset(); } }}
        title={inviteResult ? "¡Colaborador creado!" : "Nuevo colaborador"}
        description={inviteResult ? undefined : "Elige las categorías y los servicios que realiza."}
        className="max-w-lg"
      >
        {/* ── Success state: show invite link ── */}
        {inviteResult ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 pt-2 pb-1 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-stone-600">
                  El colaborador fue registrado. Copia el enlace de acceso y envíalo por WhatsApp o correo.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 space-y-3">
              <p className="text-xs font-semibold text-brand-700 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Enlace de acceso (válido 7 días)
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="h-9 flex-1 min-w-0 rounded-lg border border-brand-200 bg-white px-3 text-xs text-stone-600 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-text"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
                    copied
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-brand-600 text-white hover:bg-brand-700"
                  )}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <p className="text-xs text-stone-400">
                El colaborador abrirá este link para crear su contraseña y acceder al sistema.
              </p>
            </div>

            <Button variant="primary" className="w-full" onClick={handleCloseSuccess}>
              Listo
            </Button>
          </div>
        ) : (
        /* ── Create form ── */
          <form action={handleCreate} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Input name="first_name" label="Nombre" required />
              <Input name="last_name" label="Apellido" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="phone" label="Teléfono" type="tel" />
              <Input
                name="email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setArchivedMatch(null); setError(null); }}
                onBlur={() => checkArchivedEmail()}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="commission_percentage" label="Comisión (%)" type="number" min={0} max={100} defaultValue={0} />
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Rol</label>
                {roles.length === 0 ? (
                  <p className="text-xs text-stone-400 pt-1">Sin roles — crea uno en <strong>Roles</strong> primero.</p>
                ) : (
                  <Select name="role_id" className="w-full">
                    <option value="">Sin rol por ahora</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-stone-700">1. Categorías que atiende</p>
              {categories.length === 0 ? (
                <p className="text-xs text-stone-400">No hay categorías. Crea servicios primero.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const sel = selectedCats.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCat(c.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          sel
                            ? "border-brand-400 bg-brand-50 text-brand-700"
                            : "border-stone-200 text-stone-600 hover:bg-stone-50"
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedCats.map((id) => (
                <input key={id} type="hidden" name="category_ids" value={id} />
              ))}
            </div>

            {selectedCategoryObjs.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-stone-700">2. Servicios que realiza</p>
                <div className="space-y-3 max-h-52 overflow-y-auto rounded-xl border border-brand-100 p-3 bg-brand-50/30">
                  {selectedCategoryObjs.map((cat) => (
                    <div key={cat.id}>
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-400">{cat.name}</p>
                      {cat.services.length === 0 ? (
                        <p className="mt-1 text-xs text-stone-400">Sin servicios en esta categoría.</p>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {cat.services.map((svc) => (
                            <label key={svc.id} className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer hover:text-stone-900">
                              <input type="checkbox" name="service_ids" value={svc.id} className="rounded accent-brand-600" />
                              {svc.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-stone-400 bg-stone-50 rounded-lg px-3 py-2">
              Si ingresas email y seleccionas un rol, se generará automáticamente el enlace de acceso.
            </p>

            {archivedMatch && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <p className="font-semibold">Ya existe un colaborador archivado: {archivedMatch.name}</p>
                <p className="mt-1 text-xs">Reactivarlo conserva su historial. Luego puedes editar servicios, categorias, horarios y generar un nuevo enlace.</p>
                <Button
                  type="button"
                  variant="primary"
                  className="mt-3 w-full"
                  loading={reactivatingId === archivedMatch.id}
                  onClick={() => handleReactivateEmployee(archivedMatch.id)}
                >
                  Reactivar colaborador
                </Button>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); reset(); }}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={pending} disabled={!!archivedMatch}>
                Crear colaborador
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
