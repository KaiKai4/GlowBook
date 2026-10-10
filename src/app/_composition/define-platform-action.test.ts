import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { err, ok } from "@/infra/result";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { z } from "@/infra/validation/zod";
import { parseWithSchema } from "./define-action";
import { definePlatformAction } from "./define-platform-action";
import { requirePlatformAdminProof } from "./request-context";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./request-context", () => ({ requirePlatformAdminProof: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));

const ADMIN_ID = "admin-1";
const SCHEMA = z.object({ name: z.string().min(2, "Nombre demasiado corto") });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePlatformAdminProof).mockResolvedValue(issuePlatformAdminProof(ADMIN_ID));
  vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
});

describe("definePlatformAction", () => {
  it("sin ser platform admin propaga la redireccion sin tocar el rate limit ni el caso de uso", async () => {
    vi.mocked(requirePlatformAdminProof).mockRejectedValue(new Error("NEXT_REDIRECT:/login"));
    const run = vi.fn();
    const action = definePlatformAction({
      rateLimit: { scope: "admin:x" },
      parse: parseWithSchema(SCHEMA),
      run,
    });

    await expect(action({ name: "Ana" })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("aplica el rate limit al id del administrador con el ambito y las opciones indicadas", async () => {
    const action = definePlatformAction({
      rateLimit: { scope: "admin:x", options: { max: 5, windowMs: 1000 } },
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(ok(undefined)),
    });

    await action({ name: "Ana" });

    expect(assertActionRateLimit).toHaveBeenCalledWith(ADMIN_ID, "admin:x", { max: 5, windowMs: 1000 });
  });

  it("sin opciones de rate limit delega el límite por defecto en assertActionRateLimit", async () => {
    const action = definePlatformAction({
      rateLimit: { scope: "admin:x" },
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(ok(undefined)),
    });

    await action({ name: "Ana" });

    expect(assertActionRateLimit).toHaveBeenCalledWith(ADMIN_ID, "admin:x", undefined);
  });

  it("si el rate limit bloquea no válida ni ejecuta el caso de uso", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));
    const run = vi.fn();
    const action = definePlatformAction({
      rateLimit: { scope: "admin:x" },
      parse: parseWithSchema(SCHEMA),
      run,
    });

    const result = await action({ name: "Ana" });

    expect(result).toEqual(err("Demasiados intentos."));
    expect(run).not.toHaveBeenCalled();
  });

  it("ejecuta el caso de uso una vez con el id del administrador y el dato validado", async () => {
    const run = vi.fn().mockResolvedValue(ok("creado"));
    const action = definePlatformAction({ parse: parseWithSchema(SCHEMA), run });

    const result = await action({ name: "Ana" });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ name: "Ana" }, expect.objectContaining({ userId: ADMIN_ID, proof: issuePlatformAdminProof(ADMIN_ID) }));
    expect(result).toEqual(ok("creado"));
  });

  it("un dato inválido devuelve el primer mensaje del schema sin ejecutar el caso de uso", async () => {
    const run = vi.fn();
    const action = definePlatformAction({ parse: parseWithSchema(SCHEMA), run });

    const result = await action({ name: "A" });

    expect(result).toEqual(err("Nombre demasiado corto"));
    expect(run).not.toHaveBeenCalled();
  });

  it("revalida las rutas solo cuando el caso de uso responde ok", async () => {
    const action = definePlatformAction({
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(ok("creado")),
      revalidate: (output) => ["/admin", `/admin/${output}`],
    });

    await action({ name: "Ana" });

    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/creado");
  });

  it("si el caso de uso falla devuelve su error tal cual y no revalida", async () => {
    const revalidate = vi.fn(() => ["/admin"]);
    const action = definePlatformAction({
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(err("Conflicto.")),
      revalidate,
    });

    const result = await action({ name: "Ana" });

    expect(result).toEqual(err("Conflicto."));
    expect(revalidate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
