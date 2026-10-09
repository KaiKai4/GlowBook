// Catálogo fijo del estudio de precios de staging: métodos de pago, salones, categorías,
// empleados, nombres, productos y gastos. Solo datos (sin E/S ni lógica).

/** Métodos de pago que usan las ventas y citas completadas del estudio. */
export const PAYMENT_METHODS = ["Efectivo", "Tarjeta", "Yappy", "Transferencia", "Zinli"];

/** Salones del estudio: nombre, tema y color primario. */
export const SALON_BLUEPRINTS = [
  { name: "GlowBook Pricing Studio 1", theme: "violet", primaryColor: "#7C3AED" },
  { name: "GlowBook Pricing Studio 2", theme: "orchid", primaryColor: "#9333EA" },
  { name: "GlowBook Pricing Studio 3", theme: "aqua", primaryColor: "#2563EB" },
  { name: "GlowBook Pricing Studio 4", theme: "mint", primaryColor: "#059669" },
  { name: "GlowBook Pricing Studio 5", theme: "rose", primaryColor: "#DB2777" },
  { name: "GlowBook Pricing Studio 6", theme: "indigo", primaryColor: "#4F46E5" },
];

/**
 * Categorías de servicio con su modo de precio y sus servicios [nombre, minutos, precio].
 * @type {{ name: string, pricing_mode: string, services: [string, number, number][] }[]}
 */
export const CATEGORY_BLUEPRINTS = [
  {
    name: "Cabello",
    pricing_mode: "fixed",
    services: [
      ["Corte y secado", 45, 28],
      ["Color completo", 120, 85],
      ["Tratamiento hidratante", 60, 45],
    ],
  },
  {
    name: "Unas",
    pricing_mode: "variable",
    services: [
      ["Manicura tradicional", 35, 18],
      ["Softgel", 75, 35],
      ["Acrilico", 90, 45],
    ],
  },
  {
    name: "Estetica",
    pricing_mode: "fixed",
    services: [
      ["Limpieza facial", 70, 55],
      ["Depilacion de cejas", 30, 20],
      ["Pestanas lifting", 65, 40],
    ],
  },
  {
    name: "Masaje",
    pricing_mode: "fixed",
    services: [
      ["Relajante", 50, 30],
      ["Deportivo", 80, 55],
      ["Cuerpo completo", 100, 75],
    ],
  },
];

/** Empleadas del estudio: nombre, apellido y especialidad (nombre de categoría). */
export const EMPLOYEE_NAMES = [
  ["Ana", "Morrison", "Cabello"],
  ["Valeria", "Castillo", "Unas"],
  ["Nohemy", "Valderrama", "Estetica"],
  ["Karla", "Rodriguez", "Unas"],
  ["Genesis", "Rivas", "Masaje"],
  ["Laura", "Mendez", "Cabello"],
];

/** Nombres de pila para clientas generadas. */
export const FIRST_NAMES = [
  "Alejandra",
  "Allan",
  "Camila",
  "Daniela",
  "Elena",
  "Fabiana",
  "Gabriel",
  "Isabella",
  "Juan",
  "Karla",
  "Keily",
  "Maria",
  "Nohemy",
  "Sara",
  "Sofia",
  "Valery",
  "Victoria",
  "Yamileth",
];

/** Apellidos para clientas generadas. */
export const LAST_NAMES = [
  "Nunez",
  "Ordonez",
  "Herrera",
  "Rodriguez",
  "Sanchez",
  "Pitty",
  "Villanueva",
  "Martinez",
  "Perez",
  "Castillo",
  "Morales",
  "Rojas",
];

/**
 * Productos: [nombre, categoría, costo base, precio base].
 * @type {[string, string, number, number][]}
 */
export const PRODUCTS = [
  ["Shampoo hidratante", "Cabello", 8, 18],
  ["Acondicionador reparador", "Cabello", 7, 16],
  ["Mascarilla capilar", "Cabello", 12, 28],
  ["Aceite de cuticula", "Unas", 4, 10],
  ["Base coat", "Unas", 6, 14],
  ["Top coat brillo", "Unas", 7, 16],
  ["Serum facial", "Estetica", 14, 32],
  ["Protector solar facial", "Estetica", 10, 24],
  ["Crema hidratante", "Estetica", 9, 22],
  ["Aceite de masaje", "Masaje", 11, 26],
  ["Exfoliante corporal", "Masaje", 13, 30],
  ["Vela aromatica", "Complementos", 5, 12],
  ["Gel fijador", "Cabello", 6, 15],
  ["Removedor sin acetona", "Unas", 3, 8],
  ["Bruma facial", "Estetica", 8, 20],
];

/** Gastos recurrentes: [categoría, concepto, proveedor]. */
export const EXPENSES = [
  ["rent", "Alquiler mensual", "Administracion Plaza"],
  ["utilities", "Servicios basicos", "Ensa / Idaan"],
  ["supplies", "Suministros de salon", "Distribuidora Belleza"],
  ["payroll", "Comisiones y apoyo", "Equipo interno"],
  ["maintenance", "Mantenimiento de equipos", "Tecnico certificado"],
  ["other", "Publicidad local", "Campanas digitales"],
  ["other", "Lavanderia", "Proveedor local"],
  ["supplies", "Insumos descartables", "Proveedor mayorista"],
];
