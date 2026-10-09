// Clases del menu lateral por modo de preferencia. Tailwind necesita las clases
// literales en el código, por eso cada tabla da tres variantes:
// - collapsed / expanded: clases fijas (preferencia guardada por el usuario).
// - auto: solo CSS responsivo (plegada por debajo de md, desplegada desde md), que
//   coincide con el primer render del servidor y no provoca salto de layout.
import type { SidebarPreference } from "./sidebar-store";

type ModeClasses = Record<SidebarPreference, string>;

/**
 * Estado plegado efectivo para el cliente (aria, etiquetas, ocultación de bloques):
 * la preferencia guardada manda; en "auto" lo decide el ancho del viewport.
 */
export function resolveSidebarCollapsed(
  preference: SidebarPreference,
  desktop: boolean,
): boolean {
  if (preference === "auto") return !desktop;
  return preference === "collapsed";
}

export const ASIDE_WIDTH: ModeClasses = {
  collapsed: "w-20",
  expanded: "w-64",
  auto: "w-20 md:w-64",
};

export const TOGGLE_POSITION: ModeClasses = {
  collapsed: "left-1/2 top-[88px] -translate-x-1/2",
  expanded: "right-12 top-[88px]",
  auto: "left-1/2 top-[88px] -translate-x-1/2 md:left-auto md:translate-x-0 md:right-12",
};

export const BRAND_TEXT: ModeClasses = {
  collapsed: "pointer-events-none opacity-0",
  expanded: "opacity-100",
  auto: "pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100",
};

export const BRAND_MARK: ModeClasses = {
  collapsed: "opacity-100",
  expanded: "pointer-events-none opacity-0",
  auto: "opacity-100 md:pointer-events-none md:opacity-0",
};

export const NAV_PADDING: ModeClasses = {
  collapsed: "px-2",
  expanded: "px-3",
  auto: "px-2 md:px-3",
};

export const GROUP_STACK: ModeClasses = {
  collapsed: "space-y-3",
  expanded: "space-y-5",
  auto: "space-y-3 md:space-y-5",
};

/** Separador entre grupos (solo a partir del segundo grupo). */
export const GROUP_SEPARATOR: ModeClasses = {
  collapsed: "border-t border-brand-50 pt-3",
  expanded: "",
  auto: "border-t border-brand-50 pt-3 md:border-t-0 md:pt-0",
};

/** Encabezado de grupo: en "collapsed" no se renderiza (valor de respaldo sin uso). */
export const GROUP_LABEL: ModeClasses = {
  collapsed: "hidden",
  expanded: "",
  auto: "hidden md:block",
};

/** Aviso de "sin módulos": en plegada queda solo para lectores de pantalla. */
export const NO_MODULES_HINT: ModeClasses = {
  collapsed: "sr-only",
  expanded: "",
  auto: "sr-only md:not-sr-only",
};

/** Filas de navegación y de cierre de sesión (icono + etiqueta en rejilla). */
export const ITEM_LAYOUT: ModeClasses = {
  collapsed: "grid-cols-[16px_0fr] justify-center gap-0 px-3",
  expanded: "grid-cols-[16px_1fr] gap-3 px-3",
  auto: "grid-cols-[16px_0fr] justify-center gap-0 px-3 md:grid-cols-[16px_1fr] md:justify-normal md:gap-3",
};

export const LABEL_FADE: ModeClasses = {
  collapsed: "opacity-0",
  expanded: "opacity-100",
  auto: "opacity-0 md:opacity-100",
};
