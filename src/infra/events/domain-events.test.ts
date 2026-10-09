import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { createDomainEventBus } from "./domain-events";
import { registerDomainEventHandlers } from "./register-handlers";

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedCapture = vi.mocked(captureError);
const context = { module: "platform", action: "record_audit" };

type TestEvents = {
  "platform.salon_deleted": { salonId: string };
  "salon.invitation_accepted": { userId: string };
};

describe("createDomainEventBus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("entrega el payload tipado solo a los manejadores del evento emitido", async () => {
    const bus = createDomainEventBus<TestEvents>();
    const deleted = vi.fn(async () => undefined);
    const accepted = vi.fn(async () => undefined);
    bus.subscribe("platform.salon_deleted", deleted);
    bus.subscribe("salon.invitation_accepted", accepted);

    const warnings = await bus.publish("platform.salon_deleted", { salonId: "salon-1" }, context);

    expect(warnings).toEqual([]);
    expect(deleted).toHaveBeenCalledTimes(1);
    expect(accepted).not.toHaveBeenCalled();
  });

  it("pasa al manejador solo el payload, sin el bus, para que no pueda reemitir", async () => {
    const bus = createDomainEventBus<TestEvents>();
    const handler = vi.fn(async () => undefined);
    bus.subscribe("platform.salon_deleted", handler);

    await bus.publish("platform.salon_deleted", { salonId: "salon-1" }, context);

    expect(handler.mock.calls[0]).toEqual([{ salonId: "salon-1" }]);
  });

  it("convierte el fallo de un manejador en aviso sin detener a los demas", async () => {
    const bus = createDomainEventBus<TestEvents>();
    const failure = new Error("sin conexion");
    const after = vi.fn(async () => undefined);
    bus.subscribe("platform.salon_deleted", async () => {
      throw failure;
    });
    bus.subscribe("platform.salon_deleted", after);

    const warnings = await bus.publish("platform.salon_deleted", { salonId: "salon-1" }, context);

    expect(warnings).toEqual(["No se completó el paso «platform.salon_deleted»."]);
    expect(after).toHaveBeenCalledTimes(1);
    expect(mockedCapture).toHaveBeenCalledWith(failure, {
      module: "platform",
      action: "record_audit",
      metadata: { effect: "platform.salon_deleted" },
    });
  });

  it("no hace nada y no avisa cuando el evento no tiene manejadores", async () => {
    const bus = createDomainEventBus<TestEvents>();

    const warnings = await bus.publish("salon.invitation_accepted", { userId: "u-1" }, context);

    expect(warnings).toEqual([]);
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it("aisla buses distintos: un manejador de otro bus no se ejecuta", async () => {
    const first = createDomainEventBus<TestEvents>();
    const second = createDomainEventBus<TestEvents>();
    const handler = vi.fn(async () => undefined);
    first.subscribe("platform.salon_deleted", handler);

    await second.publish("platform.salon_deleted", { salonId: "salon-1" }, context);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("registerDomainEventHandlers", () => {
  it("suscribe la tabla completa una sola vez aunque se llame varias veces", async () => {
    const bus = createDomainEventBus<TestEvents>();
    const deleted = vi.fn(async () => undefined);
    const accepted = vi.fn(async () => undefined);
    const table = { "platform.salon_deleted": deleted, "salon.invitation_accepted": accepted };

    registerDomainEventHandlers(bus, table);
    registerDomainEventHandlers(bus, table);
    await bus.publish("platform.salon_deleted", { salonId: "salon-1" }, context);
    await bus.publish("salon.invitation_accepted", { userId: "u-1" }, context);

    expect(deleted).toHaveBeenCalledTimes(1);
    expect(accepted).toHaveBeenCalledTimes(1);
  });
});
