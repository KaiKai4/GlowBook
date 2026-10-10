import type { Permission } from "@/features/access";

// Textos visibles de cada permiso en /roles. El tipo Record obliga a cubrir
// cada permiso del catalogo: un permiso nuevo no compila hasta tener texto.
export const PERMISSION_TEXTS: Record<Permission, { label: string; description: string }> = {
  "salon.manage": { label: "Editar datos del salón", description: "Nombre, dirección, horarios y configuración general" },
  "roles.manage": { label: "Gestionar roles y permisos", description: "Crear roles y definir qué puede hacer cada colaborador" },
  "employees.manage": { label: "Gestionar colaboradores", description: "Crear, editar y dar acceso a colaboradores" },
  "services.manage": { label: "Gestionar servicios", description: "Crear y editar categorías y servicios del catálogo" },
  "inventory.manage": { label: "Gestionar inventario", description: "Crear productos, reponer stock y registrar movimientos" },
  "retail.manage": { label: "Gestionar vitrina", description: "Registrar ventas de productos y cobrar vitrina" },
  "expenses.manage": { label: "Gestionar gastos", description: "Registrar egresos operativos del salón" },
  "customers.manage": { label: "Gestionar clientes", description: "Crear, editar y consultar la ficha de clientes" },
  "appointments.view": { label: "Ver el calendario y sus citas", description: "Acceso de solo lectura: ve su calendario con las citas asignadas, sin poder crear ni editar" },
  "appointments.manage": { label: "Crear y gestionar citas", description: "Agendar, editar, confirmar, completar y cancelar citas" },
  "appointments.view_all": { label: "Ver todas las citas del salón", description: "Complemento de los permisos de citas: sin esto, el colaborador solo ve las citas donde está asignado" },
  "reports.view": { label: "Ver reportes e indicadores", description: "Acceder al dashboard y métricas del salón" },
  "reminders.send": { label: "Enviar recordatorios", description: "Enviar mensajes de recordatorio a los clientes" },
};
