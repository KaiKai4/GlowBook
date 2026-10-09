import type {
  PlatformAdminFixture,
  SalonOwnerFixture,
} from "../../src/test/supabase-integration-fixtures";

/**
 * Variable de entorno con los fixtures creados por global-setup (JSON).
 * Los workers de Playwright heredan process.env tras el globalSetup, así que
 * cada spec lee aquí los datos sin volver a crearlos.
 */
export const LOCAL_FIXTURES_ENV = "E2E_LOCAL_FIXTURES";

export interface LocalE2eFixtures {
  salonOwnerA: SalonOwnerFixture;
  salonOwnerB: SalonOwnerFixture;
  // Salón propio del proyecto "mobile": no comparte datos mutados por el proyecto de escritorio.
  salonOwnerMobile: SalonOwnerFixture;
  platformAdmin: PlatformAdminFixture;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Fixture E2E inválido: ${label} no es un objeto.`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Fixture E2E inválido: falta "${key}".`);
  }
  return value;
}

function toSalonOwner(value: unknown, label: string): SalonOwnerFixture {
  const record = requireRecord(value, label);
  return {
    email: requireString(record, "email"),
    password: requireString(record, "password"),
    userId: requireString(record, "userId"),
    salonId: requireString(record, "salonId"),
    customerId: requireString(record, "customerId"),
    employeeId: requireString(record, "employeeId"),
    serviceId: requireString(record, "serviceId"),
  };
}

function toPlatformAdmin(value: unknown): PlatformAdminFixture {
  const record = requireRecord(value, "platformAdmin");
  return {
    email: requireString(record, "email"),
    password: requireString(record, "password"),
    userId: requireString(record, "userId"),
  };
}

export function serializeLocalFixtures(fixtures: LocalE2eFixtures): string {
  return JSON.stringify(fixtures);
}

export function readLocalFixtures(): LocalE2eFixtures {
  const raw = process.env[LOCAL_FIXTURES_ENV];
  if (!raw) {
    throw new Error(
      `Falta ${LOCAL_FIXTURES_ENV}: global-setup no preparó los fixtures E2E locales.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${LOCAL_FIXTURES_ENV} no contiene JSON válido.`);
  }

  const record = requireRecord(parsed, LOCAL_FIXTURES_ENV);
  return {
    salonOwnerA: toSalonOwner(record.salonOwnerA, "salonOwnerA"),
    salonOwnerB: toSalonOwner(record.salonOwnerB, "salonOwnerB"),
    salonOwnerMobile: toSalonOwner(record.salonOwnerMobile, "salonOwnerMobile"),
    platformAdmin: toPlatformAdmin(record.platformAdmin),
  };
}
