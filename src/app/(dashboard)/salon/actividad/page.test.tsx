// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSalonActivity, type SalonActivityViewModel } from "@/features/salon/use-cases/get-salon-activity";
import { hasPermission } from "@/features/access";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import SalonActivityPage from "./page";

vi.mock("@/app/_composition/request-context", () => ({
  requireProfile: vi.fn(async () => ({ id: "user-1", salon_id: "salon-1" })),
}));

vi.mock("@/features/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/access")>()),
  hasPermission: vi.fn(),
}));

vi.mock("@/features/salon/use-cases/get-salon-activity", () => ({
  getSalonActivity: vi.fn(),
}));

const VIEW: SalonActivityViewModel = {
  entries: [
    {
      id: "log-1",
      actorEmail: "dueña@salon.test",
      actionLabel: "Creó servicio",
      recordLabel: "Corte de cabello",
      dateLabel: "lunes, 5 de octubre de 2026",
      timeLabel: "09:15",
    },
    {
      id: "log-2",
      actorEmail: "",
      actionLabel: "Eliminó categoría",
      recordLabel: "",
      dateLabel: "lunes, 5 de octubre de 2026",
      timeLabel: "11:40",
    },
    {
      id: "log-3",
      actorEmail: "dueña@salon.test",
      actionLabel: "Editó horarios",
      recordLabel: "",
      dateLabel: "martes, 6 de octubre de 2026",
      timeLabel: "08:05",
    },
  ],
};

describe("SalonActivityPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(hasPermission).mockReset();
    vi.mocked(getSalonActivity).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega el log sin cargar actividad cuando no tiene permiso de gestión", async () => {
    vi.mocked(hasPermission).mockReturnValue(false);

    mounted = mountComponent(await SalonActivityPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para ver el log de actividad.");
    expect(getSalonActivity).not.toHaveBeenCalled();
  });

  it("muestra un estado vacío cuando todavía no hay actividad registrada", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getSalonActivity).mockResolvedValue({ entries: [] });

    mounted = mountComponent(await SalonActivityPage());

    expect(mounted.container.textContent).toContain("Todavía no hay actividad registrada.");
    expect(mounted.container.querySelector("section")).toBeNull();
  });

  it("agrupa las entradas por fecha conservando el orden recibido", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getSalonActivity).mockResolvedValue(VIEW);

    mounted = mountComponent(await SalonActivityPage());

    const headings = Array.from(mounted.container.querySelectorAll("section h2")).map((heading) => heading.textContent);
    expect(headings).toEqual(["lunes, 5 de octubre de 2026", "martes, 6 de octubre de 2026"]);
    const sections = mounted.container.querySelectorAll("section");
    expect(sections[0]?.querySelectorAll(":scope > div > div > div").length).toBe(2);
    expect(sections[1]?.querySelectorAll(":scope > div > div > div").length).toBe(1);
  });

  it("muestra la hora, la acción, el registro afectado y el autor de cada entrada", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getSalonActivity).mockResolvedValue(VIEW);

    mounted = mountComponent(await SalonActivityPage());

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("09:15");
    expect(text).toContain("Creó servicio");
    expect(text).toContain("· Corte de cabello");
    expect(text).toContain("dueña@salon.test");
    expect(text).toContain("Eliminó categoría");
    expect(text).not.toContain("· undefined");
  });

  it("ofrece volver a la configuración del salón", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getSalonActivity).mockResolvedValue({ entries: [] });

    mounted = mountComponent(await SalonActivityPage());

    expect(mounted.container.querySelector<HTMLAnchorElement>('a[href="/salon"]')?.textContent).toContain(
      "Volver a configuración"
    );
  });
});
