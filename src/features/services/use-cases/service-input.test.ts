import { describe, expect, it } from "vitest";
import { err, ok } from "@/infra/result";
import {
  parseCategoryPricingInput,
  parseCreateCategoryInput,
  parseCreateServiceInput,
  parseIdentifier,
  parseUpdateServiceInput,
} from "./service-input";

const CATEGORY_ID = "00000000-0000-4000-8000-0000000000cc";
const SERVICE_ID = "00000000-0000-4000-8000-0000000000dd";
const DURATION_MESSAGE = "Indica una duración valida: horas desde 0 y minutos entre 0 y 59.";
const INVALID_ID_MESSAGE = "Identificador inválido.";

const validCreateService = {
  category_id: CATEGORY_ID,
  name: "Corte",
  description: "",
  duration: { hours: 1, minutes: 30 },
  price: 150,
};

describe("parseIdentifier", () => {
  it("acepta un UUID y rechaza cualquier otro valor", () => {
    expect(parseIdentifier(CATEGORY_ID)).toEqual(ok(CATEGORY_ID));
    expect(parseIdentifier("no-es-uuid")).toEqual(err(INVALID_ID_MESSAGE));
  });
});

describe("duración del servicio", () => {
  const withDuration = (duration: { hours: number; minutes: number }) =>
    parseCreateServiceInput({ ...validCreateService, duration });

  it("combina horas y minutos en minutos totales", () => {
    expect(withDuration({ hours: 1, minutes: 30 })).toMatchObject({ ok: true, value: { duration_minutes: 90 } });
    expect(withDuration({ hours: 0, minutes: 59 })).toMatchObject({ ok: true, value: { duration_minutes: 59 } });
  });

  it("rechaza minutos fuera de 0-59, horas negativas y duración cero", () => {
    expect(withDuration({ hours: 1, minutes: 60 })).toEqual(err(DURATION_MESSAGE));
    expect(withDuration({ hours: -1, minutes: 10 })).toEqual(err(DURATION_MESSAGE));
    expect(withDuration({ hours: 0, minutes: 0 })).toEqual(err(DURATION_MESSAGE));
  });
});

describe("parseCreateCategoryInput", () => {
  it("aplica los valores por defecto del esquema", () => {
    const result = parseCreateCategoryInput({
      name: "Cortes",
      description: undefined,
      ordering: 0,
      pricing_mode: "fixed",
    });
    expect(result).toEqual(ok({ name: "Cortes", description: "", ordering: 0, pricing_mode: "fixed" }));
  });

  it("devuelve el primer mensaje de validación del nombre", () => {
    expect(
      parseCreateCategoryInput({ name: "", description: "", ordering: 0, pricing_mode: "fixed" })
    ).toEqual(err("El nombre es obligatorio"));
  });
});

describe("parseCategoryPricingInput", () => {
  it("rechaza un identificador inválido antes de validar el modo", () => {
    expect(parseCategoryPricingInput("bad", "variable")).toEqual(err(INVALID_ID_MESSAGE));
  });

  it("devuelve el id y solo el campo de precio", () => {
    expect(parseCategoryPricingInput(CATEGORY_ID, "variable")).toEqual(
      ok({ categoryId: CATEGORY_ID, data: { pricing_mode: "variable" } })
    );
  });
});

describe("parseCreateServiceInput", () => {
  it("valida la duración antes que el esquema y combina los minutos", () => {
    expect(parseCreateServiceInput({ ...validCreateService, duration: { hours: 0, minutes: 0 } })).toEqual(
      err(DURATION_MESSAGE)
    );
    expect(parseCreateServiceInput(validCreateService)).toEqual(
      ok({
        category_id: CATEGORY_ID,
        name: "Corte",
        description: "",
        duration_minutes: 90,
        price: 150,
      })
    );
  });

  it("rechaza una categoría inválida con el mensaje del esquema", () => {
    expect(parseCreateServiceInput({ ...validCreateService, category_id: "nope" })).toEqual(
      err("Categoría inválida")
    );
  });
});

describe("parseUpdateServiceInput", () => {
  const fields = {
    name: "Tinte",
    description: undefined,
    duration: { hours: 2, minutes: 0 },
    price: undefined,
    is_active: false,
  };

  it("rechaza un identificador inválido antes de mirar la duración", () => {
    expect(parseUpdateServiceInput("bad", { ...fields, duration: { hours: 0, minutes: 0 } })).toEqual(
      err(INVALID_ID_MESSAGE)
    );
  });

  it("valida la duración y devuelve solo los campos presentes", () => {
    expect(parseUpdateServiceInput(SERVICE_ID, { ...fields, duration: { hours: 0, minutes: 0 } })).toEqual(
      err(DURATION_MESSAGE)
    );
    expect(parseUpdateServiceInput(SERVICE_ID, fields)).toEqual(
      ok({
        serviceId: SERVICE_ID,
        data: { name: "Tinte", duration_minutes: 120, is_active: false },
      })
    );
  });

  it("rechaza un precio negativo con el mensaje del esquema", () => {
    expect(parseUpdateServiceInput(SERVICE_ID, { ...fields, price: -1 })).toEqual(
      err("El precio no puede ser negativo")
    );
  });
});
