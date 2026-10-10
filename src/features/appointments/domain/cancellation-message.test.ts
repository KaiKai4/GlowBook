import { describe, expect, it } from "vitest";
import {
  buildWhatsAppUrl,
  temporaryCustomerActionFor,
} from "./cancellation-message";

describe("temporaryCustomerActionFor", () => {
  it("no toca a los clientes permanentes, elija lo que elija el usuario", () => {
    expect(temporaryCustomerActionFor(false, "save")).toBeNull();
    expect(temporaryCustomerActionFor(false, "discard")).toBeNull();
  });

  it("promueve al temporal si el usuario decide guardarlo", () => {
    expect(temporaryCustomerActionFor(true, "save")).toBe("promote");
  });

  it("descarta al temporal si el usuario decide no guardarlo", () => {
    expect(temporaryCustomerActionFor(true, "discard")).toBe("discard");
  });
});

describe("buildWhatsAppUrl", () => {
  it("deja solo dígitos en el teléfono y codifica el mensaje", () => {
    expect(buildWhatsAppUrl("+507 6000-1234", "Hola Ana & equipo")).toBe(
      "https://wa.me/50760001234?text=Hola%20Ana%20%26%20equipo"
    );
  });
});
