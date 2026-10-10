import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS, type ActionContext } from "@/features/access";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { isEffectiveSalonModuleEnabled } from "@/features/billing";
import { err, ok } from "@/infra/result";
import { z } from "@/infra/validation/zod";
import { requireActionContext } from "./request-context";
import { defineAction, parseWithSchema } from "./define-action";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./request-context", () => ({ requireActionContext: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({ isEffectiveSalonModuleEnabled: vi.fn() }));

const SCHEMA = z.object({ name: z.string().min(2, "Nombre demasiado corto") });

/** Contexto minimo de una sesion con los permisos indicados. */
function contextWith(permissions: ActionContext["permissions"]): ActionContext {
  return { userId: "user-1", salonId: "salon-1", permissions, requestId: "req-1", rolesEnabled: true, disabledFeatures: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireActionContext).mockResolvedValue(contextWith([PERMISSIONS.EMPLOYEES_MANAGE]));
  vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
  vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
});

describe("defineAction: permisos", () => {
  it("sin el permiso devuelve el mensaje de denegacion sin tocar el caso de uso", async () => {
    vi.mocked(requireActionContext).mockResolvedValue(contextWith([]));
    const run = vi.fn();
    const action = defineAction({
      permission: { key: PERMISSIONS.EMPLOYEES_MANAGE, deniedMessage: "No tienes permiso." },
      parse: parseWithSchema(SCHEMA),
      run,
    });

    const result = await action({ name: "Ana" });

    expect(result).toEqual(err("No tienes permiso."));
    expect(run).not.toHaveBeenCalled();
  });

  it("con el permiso ejecuta el caso de uso una vez con el contexto mínimo y el dato validado", async () => {
    const run = vi.fn().mockResolvedValue(ok("creado"));
    const action = defineAction({
      permission: { key: PERMISSIONS.EMPLOYEES_MANAGE, deniedMessage: "No tienes permiso." },
      parse: parseWithSchema(SCHEMA),
      run,
    });

    const result = await action({ name: "Ana" });

    expect(result).toEqual(ok("creado"));
    expect(run).toHaveBeenCalledTimes(1);
    // El caso de uso recibe el contexto minimo: nunca el perfil completo.
    expect(run).toHaveBeenCalledWith({ name: "Ana" }, contextWith([PERMISSIONS.EMPLOYEES_MANAGE]));
    expect(run.mock.calls[0]?.[1]).not.toHaveProperty("profile");
  });

  it("con varias claves exige todas: faltar una basta para denegar", async () => {
    vi.mocked(requireActionContext).mockResolvedValue(contextWith([PERMISSIONS.EXPENSES_MANAGE]));
    const run = vi.fn();
    const action = defineAction({
      permission: {
        key: [PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.INVENTORY_MANAGE],
        deniedMessage: "Falta un permiso.",
      },
      parse: parseWithSchema(SCHEMA),
      run,
    });

    expect(await action({ name: "Ana" })).toEqual(err("Falta un permiso."));
    expect(run).not.toHaveBeenCalled();
  });

  it("con varias claves y todas presentes ejecuta el caso de uso", async () => {
    vi.mocked(requireActionContext).mockResolvedValue(
      contextWith([PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.INVENTORY_MANAGE])
    );
    const run = vi.fn().mockResolvedValue(ok("hecho"));
    const action = defineAction({
      permission: {
        key: [PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.INVENTORY_MANAGE],
        deniedMessage: "Falta un permiso.",
      },
      parse: parseWithSchema(SCHEMA),
      run,
    });

    expect(await action({ name: "Ana" })).toEqual(ok("hecho"));
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("defineAction: flujo", () => {
  it("aplica el rate limit con el id del usuario y el ambito indicado", async () => {
    const action = defineAction({
      rateLimit: { scope: "feedback", options: { max: 5, windowMs: 300_000 } },
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(ok(undefined)),
    });

    await action({ name: "Ana" });

    expect(assertActionRateLimit).toHaveBeenCalledWith("user-1", "feedback", { max: 5, windowMs: 300_000 });
  });

  it("si el rate limit bloquea no válida ni ejecuta el caso de uso", async () => {
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

  it("un dato inválido devuelve el primer mensaje del schema sin ejecutar el caso de uso", async () => {
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

  it("sin sesión el error de requireActionContext se propaga", async () => {
    vi.mocked(requireActionContext).mockRejectedValue(new Error("NEXT_REDIRECT:/login"));
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

describe("defineAction: guarda de módulo", () => {
  const MODULE_DENIED = "Este módulo no está incluido en el plan de este salón.";

  it("con el módulo deshabilitado responde error sin rate limit ni caso de uso", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);
    const run = vi.fn();
    const action = defineAction({
      module: "plantillas",
      rateLimit: { scope: "plantillas", options: { max: 5, windowMs: 300_000 } },
      parse: parseWithSchema(SCHEMA),
      run,
    });

    expect(await action({ name: "Ana" })).toEqual(err(MODULE_DENIED));
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("consulta el módulo con el ámbito del salón y las features heredadas del contexto", async () => {
    vi.mocked(requireActionContext).mockResolvedValue({
      ...contextWith([]),
      disabledFeatures: ["plantillas"],
    });
    const action = defineAction({
      module: "plantillas",
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(ok(undefined)),
    });

    await action({ name: "Ana" });

    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith(
      { salonId: "salon-1", disabledFeatures: ["plantillas"] },
      "plantillas"
    );
  });

  it("con el módulo habilitado ejecuta el flujo completo", async () => {
    const run = vi.fn().mockResolvedValue(ok("hecho"));
    const action = defineAction({
      module: "plantillas",
      parse: parseWithSchema(SCHEMA),
      run,
    });

    expect(await action({ name: "Ana" })).toEqual(ok("hecho"));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("sin módulo declarado no consulta el plan", async () => {
    const action = defineAction({
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(ok(undefined)),
    });

    await action({ name: "Ana" });

    expect(isEffectiveSalonModuleEnabled).not.toHaveBeenCalled();
  });

  it("el permiso se comprueba antes que el módulo: sin permiso no se consulta el plan", async () => {
    vi.mocked(requireActionContext).mockResolvedValue(contextWith([]));
    const action = defineAction({
      module: "plantillas",
      permission: { key: PERMISSIONS.EMPLOYEES_MANAGE, deniedMessage: "No tienes permiso." },
      parse: parseWithSchema(SCHEMA),
      run: vi.fn(),
    });

    expect(await action({ name: "Ana" })).toEqual(err("No tienes permiso."));
    expect(isEffectiveSalonModuleEnabled).not.toHaveBeenCalled();
  });
});

describe("defineAction: revalidación de layout", () => {
  it("un destino { path, type: 'layout' } revalida el layout y no una ruta suelta", async () => {
    const action = defineAction({
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(ok(undefined)),
      revalidate: () => [{ path: "/", type: "layout" }, "/salon"],
    });

    await action({ name: "Ana" });

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/salon");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("si el caso de uso falla no revalida el layout", async () => {
    const action = defineAction({
      parse: parseWithSchema(SCHEMA),
      run: vi.fn().mockResolvedValue(err("fallo")),
      revalidate: () => [{ path: "/", type: "layout" }],
    });

    await action({ name: "Ana" });

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
