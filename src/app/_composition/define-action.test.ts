import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { err, ok } from "@/infra/result";
import { z } from "@/infra/validation/zod";
import type { ProfileWithRole } from "@/types/app.types";
import { requireActiveProfile } from "./request-context";
import { defineAction, parseWithSchema } from "./define-action";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/features/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/access")>()),
  hasPermission: vi.fn(),
}));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));

const PROFILE = { id: "user-1", salon_id: "salon-1" } as unknown as ProfileWithRole;
const SCHEMA = z.object({ name: z.string().min(2, "Nombre demasiado corto") });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireActiveProfile).mockResolvedValue(PROFILE);
  vi.mocked(hasPermission).mockReturnValue(true);
  vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
});

describe("defineAction", () => {
  it("sin permiso devuelve el mensaje de denegacion sin tocar el caso de uso", async () => {
    vi.mocked(hasPermission).mockReturnValue(false);
    const run = vi.fn();
    const action = defineAction({
      permission: { key: PERMISSIONS.EMPLOYEES_MANAGE, deniedMessage: "No tienes permiso." },
      parse: parseWithSchema(SCHEMA),
      run,
    });

    const result = await action({ name: "Ana" });

    expect(hasPermission).toHaveBeenCalledWith(PROFILE, PERMISSIONS.EMPLOYEES_MANAGE);
    expect(result).toEqual(err("No tienes permiso."));
    expect(run).not.toHaveBeenCalled();
  });

  it("con permiso ejecuta el caso de uso una vez con la sesion y el dato validado", async () => {
    const run = vi.fn().mockResolvedValue(ok("creado"));
    const action = defineAction({
      permission: { key: PERMISSIONS.EMPLOYEES_MANAGE, deniedMessage: "No tienes permiso." },
      parse: parseWithSchema(SCHEMA),
      run,
    });

    const result = await action({ name: "Ana" });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(
      { name: "Ana" },
      { userId: "user-1", salonId: "salon-1", profile: PROFILE }
    );
    expect(result).toEqual(ok("creado"));
  });

  it("aplica el rate limit con el id del usuario y el ambito indicado", async () => {
    const action = defineAction({
      rateLimit: { scope: "feedback", options: { max: 5, windowMs: 300_000 } },
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(ok(undefined)),
    });

    await action({ name: "Ana" });

    expect(assertActionRateLimit).toHaveBeenCalledWith("user-1", "feedback", { max: 5, windowMs: 300_000 });
  });

  it("si el rate limit bloquea no valida ni ejecuta el caso de uso", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));
    const run = vi.fn();
    const action = defineAction({
      rateLimit: { scope: "feedback", options: { max: 1, windowMs: 1000 } },
      parse: parseWithSchema(SCHEMA),
      run,
    });

    const result = await action({ name: "Ana" });

    expect(result).toEqual(err("Demasiados intentos."));
    expect(run).not.toHaveBeenCalled();
  });

  it("un dato invalido devuelve el primer mensaje del schema sin ejecutar el caso de uso", async () => {
    const run = vi.fn();
    const action = defineAction({ parse: parseWithSchema(SCHEMA), run });

    const result = await action({ name: "A" });

    expect(result).toEqual(err("Nombre demasiado corto"));
    expect(run).not.toHaveBeenCalled();
  });

  it("revalida las rutas solo cuando el caso de uso responde ok", async () => {
    const action = defineAction({
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(ok("creado")),
      revalidate: (output) => ["/employees", `/employees/${output}`],
    });

    await action({ name: "Ana" });

    expect(revalidatePath).toHaveBeenCalledWith("/employees");
    expect(revalidatePath).toHaveBeenCalledWith("/employees/creado");
  });

  it("si el caso de uso falla no revalida nada y devuelve su error tal cual", async () => {
    const revalidate = vi.fn(() => ["/employees"]);
    const action = defineAction({
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(err("Conflicto.")),
      revalidate,
    });

    const result = await action({ name: "Ana" });

    expect(result).toEqual(err("Conflicto."));
    expect(revalidate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sin contexto de sesion el error de requireActiveProfile se propaga", async () => {
    vi.mocked(requireActiveProfile).mockRejectedValue(new Error("NEXT_REDIRECT:/login"));
    const run = vi.fn();
    const action = defineAction({ parse: parseWithSchema(SCHEMA), run });

    await expect(action({ name: "Ana" })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(run).not.toHaveBeenCalled();
  });
});

describe("parseWithSchema", () => {
  it("devuelve el valor parseado cuando el schema lo acepta", () => {
    expect(parseWithSchema(SCHEMA)({ name: "Ana" })).toEqual(ok({ name: "Ana" }));
  });
});
