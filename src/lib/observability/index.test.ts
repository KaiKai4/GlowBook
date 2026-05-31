import { describe, expect, it, vi } from "vitest";
import { captureError, logEvent } from ".";

describe("observability adapter", () => {
  it("does not emit console noise while tests are running", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    captureError(new Error("boom"), {
      module: "platform",
      action: "delete_salon",
      metadata: { token: "secret-token", salonId: "salon-1" },
    });
    logEvent("platform.action", {
      module: "platform",
      action: "invite_salon",
      metadata: { serviceRoleKey: "secret-key" },
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
