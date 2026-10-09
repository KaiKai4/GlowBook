import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CreateEmployeeSchema, WorkScheduleSchema } from "./schemas";

const UUID = "00000000-0000-4000-8000-000000000001";

const validEmployee = {
  first_name: "Ana",
  last_name: "Vega",
};

describe("CreateEmployeeSchema", () => {
  it("aplica valores por defecto a los campos opcionales", () => {
    expect(CreateEmployeeSchema.parse(validEmployee)).toEqual({
      first_name: "Ana",
      last_name: "Vega",
      phone: "",
      email: "",
      specialty: "",
      commission_percentage: 0,
      hire_date: undefined,
      service_ids: [],
      category_ids: [],
    });
  });

  it("exige nombre y apellido con mensajes de dominio", () => {
    const missingFirst = CreateEmployeeSchema.safeParse({ ...validEmployee, first_name: "" });
    const missingLast = CreateEmployeeSchema.safeParse({ ...validEmployee, last_name: "" });

    expect(missingFirst.success).toBe(false);
    expect(missingLast.success).toBe(false);
    if (!missingFirst.success) {
      expect(missingFirst.error.issues[0]?.message).toBe("El nombre es obligatorio");
    }
    if (!missingLast.success) {
      expect(missingLast.error.issues[0]?.message).toBe("El apellido es obligatorio");
    }
  });

  it("acepta email vacío y rechaza un email con formato inválido", () => {
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, email: "" }).success).toBe(true);
    const invalid = CreateEmployeeSchema.safeParse({ ...validEmployee, email: "no-es-email" });

    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toBe("Email inválido");
    }
  });

  it("limita la comisión entre 0 y 100 inclusive", () => {
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, commission_percentage: 0 }).success).toBe(true);
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, commission_percentage: 100 }).success).toBe(true);
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, commission_percentage: -0.01 }).success).toBe(false);
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, commission_percentage: 100.01 }).success).toBe(false);
  });

  it("property: cualquier comisión dentro de [0, 100] es válida", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (commission_percentage) => {
        expect(
          CreateEmployeeSchema.safeParse({ ...validEmployee, commission_percentage }).success
        ).toBe(true);
      })
    );
  });

  it("acepta fecha de contratación en formato de fecha y nula", () => {
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, hire_date: "2026-10-09" }).success).toBe(true);
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, hire_date: null }).success).toBe(true);
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, hire_date: "09/10/2026" }).success).toBe(false);
  });

  it("exige uuid en servicios y categorías asignadas", () => {
    expect(
      CreateEmployeeSchema.safeParse({ ...validEmployee, service_ids: [UUID], category_ids: [UUID] }).success
    ).toBe(true);
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, service_ids: ["svc-1"] }).success).toBe(false);
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, category_ids: ["cat-1"] }).success).toBe(false);
  });

  it("limita nombre y teléfono a sus longitudes máximas", () => {
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, first_name: "a".repeat(101) }).success).toBe(false);
    expect(CreateEmployeeSchema.safeParse({ ...validEmployee, phone: "1".repeat(31) }).success).toBe(false);
  });
});

describe("WorkScheduleSchema", () => {
  const validSchedule = {
    employee_id: UUID,
    day_of_week: 3,
    start_time: "09:00",
    end_time: "17:30",
  };

  it("acepta un bloque válido y activa el bloque por defecto", () => {
    expect(WorkScheduleSchema.parse(validSchedule)).toEqual({ ...validSchedule, is_active: true });
  });

  it("solo acepta días de la semana de 0 (domingo) a 6 (sábado)", () => {
    expect(WorkScheduleSchema.safeParse({ ...validSchedule, day_of_week: 0 }).success).toBe(true);
    expect(WorkScheduleSchema.safeParse({ ...validSchedule, day_of_week: 6 }).success).toBe(true);
    expect(WorkScheduleSchema.safeParse({ ...validSchedule, day_of_week: 7 }).success).toBe(false);
    expect(WorkScheduleSchema.safeParse({ ...validSchedule, day_of_week: -1 }).success).toBe(false);
    expect(WorkScheduleSchema.safeParse({ ...validSchedule, day_of_week: 2.5 }).success).toBe(false);
  });

  it("property: cualquier entero fuera de 0..6 se rechaza", () => {
    fc.assert(
      fc.property(
        fc.integer().filter((day) => day < 0 || day > 6),
        (day_of_week) => {
          expect(WorkScheduleSchema.safeParse({ ...validSchedule, day_of_week }).success).toBe(false);
        }
      )
    );
  });

  it("exige horas en formato HH:MM", () => {
    expect(WorkScheduleSchema.safeParse({ ...validSchedule, start_time: "9:00" }).success).toBe(false);
    expect(WorkScheduleSchema.safeParse({ ...validSchedule, end_time: "17:30:00" }).success).toBe(false);
    expect(WorkScheduleSchema.safeParse({ ...validSchedule, end_time: "1730" }).success).toBe(false);
  });

  it("exige un employee_id uuid", () => {
    expect(WorkScheduleSchema.safeParse({ ...validSchedule, employee_id: "e-1" }).success).toBe(false);
  });
});
