// Catálogo de datos fijos de la semilla de benchmark de precios (servicios, nombres, gastos).
// Solo constantes: no tiene efectos ni lee variables de entorno.

/** @type {[string, string, [string, number, number][]][]} */
export const SERVICE_CATALOG = [
  ["Cabello", "fixed", [["Corte y secado", 30, 28], ["Color completo", 120, 85], ["Tratamiento hidratante", 60, 45], ["Peinado", 50, 35], ["Keratina", 150, 120], ["Balayage", 180, 160], ["Rizos", 60, 45], ["Lavado especial", 30, 18]]],
  ["Unas", "variable", [["Manicura tradicional", 35, 18], ["Softgel", 75, 35], ["Acrilico", 90, 45], ["Pedicura", 45, 24], ["Gel polish", 40, 22], ["Diseno avanzado", 75, 40], ["Retiro", 30, 12], ["Reconstruccion", 110, 75]]],
  ["Estetica", "fixed", [["Limpieza facial", 70, 55], ["Depilacion de cejas", 30, 20], ["Pestanas lifting", 65, 40], ["Microblading", 120, 95], ["Mascarilla", 45, 28], ["Dermaplaning", 70, 52], ["Hidratacion facial", 60, 42], ["Peeling", 80, 68]]],
  ["Masaje", "fixed", [["Relajante", 50, 30], ["Deportivo", 80, 55], ["Cuerpo completo", 100, 75], ["Drenaje", 65, 48], ["Piedras calientes", 90, 70], ["Cuello y espalda", 45, 32], ["Reflexologia", 55, 38], ["Post operatorio", 100, 90]]],
  ["Maquillaje", "variable", [["Social", 75, 65], ["Novia prueba", 120, 110], ["Evento", 90, 80], ["Pestanas extra", 25, 18], ["Piel glow", 55, 42], ["Asesoria", 60, 50], ["Editorial", 140, 135], ["Retoque", 30, 25]]],
  ["Spa", "fixed", [["Circuito spa", 120, 95], ["Exfoliacion corporal", 60, 52], ["Envoltura", 75, 62], ["Aromaterapia", 45, 35], ["Ritual completo", 180, 150], ["Mascarilla corporal", 50, 38], ["Sauna guiado", 30, 22], ["Pack relax", 150, 125]]],
  ["Barberia", "fixed", [["Corte caballero", 35, 18], ["Barba", 25, 12], ["Perfilado", 20, 10], ["Corte y barba", 55, 28], ["Color barba", 45, 25], ["Cejas", 15, 8], ["Tratamiento barba", 35, 20], ["Fade premium", 50, 32]]],
  ["Bronceado", "fixed", [["Spray tan", 45, 35], ["Cuerpo completo", 60, 48], ["Retoque", 30, 22], ["Preparacion piel", 35, 25], ["Pack mensual", 75, 60], ["Piernas", 25, 18], ["Rostro", 20, 15], ["Premium", 90, 78]]],
];

export const FIRST_NAMES = ["Alejandra", "Allan", "Camila", "Daniela", "Elena", "Fabiana", "Gabriel", "Isabella", "Juan", "Karla", "Keily", "Maria", "Nohemy", "Sara", "Sofia", "Valery", "Victoria", "Yamileth", "Laura", "Genesis", "Ana", "Paola", "Nicole", "Andrea"];
export const LAST_NAMES = ["Nunez", "Ordonez", "Herrera", "Rodriguez", "Sanchez", "Pitty", "Villanueva", "Martinez", "Perez", "Castillo", "Morales", "Rojas", "Mendez", "Valderrama", "Gomez", "Rivera"];
export const PRODUCT_CATEGORIES = ["Cabello", "Unas", "Estetica", "Masaje", "Complementos", "Spa"];
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
