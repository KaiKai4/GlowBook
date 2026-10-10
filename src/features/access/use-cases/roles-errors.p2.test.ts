import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { deleteSalonRole } from "./delete-role";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/infra/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

type Reply = { data?: unknown; error?: unknown };

// Cliente Supabase minimo: cada from(tabla) consume la siguiente respuesta en cola de esa tabla.
// Los metodos encadenables devuelven el mismo builder; al await o con single() se resuelve la respuesta.
function fakeSupabase(queues: Record<string, Reply[]>) {
  const from = vi.fn((table: string) => {
    const reply = queues[table]?.shift() ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "insert", "delete"]) {
      builder[method] = () => builder;
    }
    builder.single = () => Promise.resolve(reply);
    builder.then = (resolve: (value: Reply) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(reply).then(resolve, reject);
    return builder;
  });
  return { from };
}

function useSupabase(queues: Record<string, Reply[]>) {
  vi.mocked(createSupabaseServerClient).mockResolvedValue(fakeSupabase(queues) as never);
}

const SALON = "00000000-0000-4000-8000-000000000001";
const ROLE = "00000000-0000-4000-8000-0000000000e1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("roles: permisos y borrado con errores de dominio", () => {
  it("borrar un rol inexistente devuelve 'Rol no encontrado.' y no borra", async () => {
    useSupabase({ roles: [{ data: null, error: null }] });

    await expect(deleteSalonRole(SALON, ROLE)).resolves.toEqual({
      ok: false,
      error: "Rol no encontrado.",
    });
  });

  it("borrar un rol de sistema devuelve 'Los roles de sistema no se pueden eliminar.'", async () => {
    useSupabase({ roles: [{ data: { is_system: true }, error: null }] });

    await expect(deleteSalonRole(SALON, ROLE)).resolves.toEqual({
      ok: false,
      error: "Los roles de sistema no se pueden eliminar.",
    });
  });
});

describe("deleteSalonRole: mensaje publico", () => {
  it("borra un rol normal y devuelve ok", async () => {
    useSupabase({
      roles: [{ data: { is_system: false }, error: null }, { data: null, error: null }],
    });

    const result = await deleteSalonRole(SALON, ROLE);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("un rol de sistema muestra el motivo de dominio, sin registrar error", async () => {
    useSupabase({ roles: [{ data: { is_system: true }, error: null }] });

    const result = await deleteSalonRole(SALON, ROLE);

    expect(result).toEqual({ ok: false, error: "Los roles de sistema no se pueden eliminar." });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("una violacion de clave externa al borrar se traduce al mensaje fijo de SQLSTATE", async () => {
    useSupabase({
      roles: [
        { data: { is_system: false }, error: null },
        { data: null, error: { code: "23503", message: "update or delete violates foreign key constraint" } },
      ],
    });

    const result = await deleteSalonRole(SALON, ROLE);

    expect(result).toEqual({
      ok: false,
      error: "La operación hace referencia a un registro inexistente.",
    });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("un error inesperado de la base usa el mensaje de respaldo y lo registra", async () => {
    const failure = { code: "XX000", message: "could not serialize access" };
    useSupabase({
      roles: [{ data: { is_system: false }, error: null }, { data: null, error: failure }],
    });

    const result = await deleteSalonRole(SALON, ROLE);

    expect(result).toEqual({ ok: false, error: "Error al eliminar el rol." });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "errors", action: "public-message" });
  });
});
