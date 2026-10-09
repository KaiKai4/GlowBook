// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/lib/result";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, flushAsync, getButtonByText } from "@/test/ui-admin-dom";
import { regenerateSalonInvitationAction } from "./actions";
import { RegenerateInviteLink } from "./regenerate-invite-link";

vi.mock("./actions", () => ({ regenerateSalonInvitationAction: vi.fn() }));

describe("RegenerateInviteLink", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(regenerateSalonInvitationAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("pide un token nuevo para la invitación indicada y muestra el enlace resultante", async () => {
    vi.mocked(regenerateSalonInvitationAction).mockResolvedValue(ok("nuevo-token"));
    mounted = mountComponent(<RegenerateInviteLink invitationId="inv-9" />);

    clickElement(getButtonByText(mounted.container, "Regenerar enlace"));
    await flushAsync();

    expect(regenerateSalonInvitationAction).toHaveBeenCalledWith("inv-9");
    expect(mounted.container.querySelector("code")?.textContent).toContain("/invite/nuevo-token");
  });

  it("muestra el error devuelto por la acción y conserva el botón para reintentar", async () => {
    vi.mocked(regenerateSalonInvitationAction).mockResolvedValue(err("La invitación ya fue aceptada."));
    mounted = mountComponent(<RegenerateInviteLink invitationId="inv-9" />);

    clickElement(getButtonByText(mounted.container, "Regenerar enlace"));
    await flushAsync();

    expect(mounted.container.textContent).toContain("La invitación ya fue aceptada.");
    expect(mounted.container.querySelector("code")).toBeNull();
    expect(getButtonByText(mounted.container, "Regenerar enlace").disabled).toBe(false);
  });

  it("indica al usuario que el enlace anterior quedará inválido", () => {
    mounted = mountComponent(<RegenerateInviteLink invitationId="inv-9" />);

    const button = getButtonByText(mounted.container, "Regenerar enlace");
    expect(button.getAttribute("title")).toBe("Genera un enlace nuevo e inválida el anterior");
  });
});
