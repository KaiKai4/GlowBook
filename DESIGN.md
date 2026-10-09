# DESIGN.md — GlowBook

Sistema de diseno canonico de GlowBook. Fuente de tokens: `src/app/globals.css` (bloque `@theme`). Principios tomados de `PRODUCT.md`.
Este documento es la referencia para migrar clases de paleta cruda a tokens semanticos. No cambia el aspecto actual hasta que cada componente se migre.

## 1. Principios

1. Priorizar la operacion diaria: acciones frecuentes visibles, rapidas y sin ambiguedad.
2. Claridad antes que decoracion: cada color, icono y agrupacion debe ayudar a decidir o actuar.
3. Sensacion premium contenida: superficies limpias, espaciado preciso, estados suaves.
4. Datos confiables: metricas, estados y conteos reflejan exactamente la realidad operativa.
5. Reducir carga cognitiva: acciones secundarias agrupadas, listas no sobrecargadas, foco en la siguiente decision.

Evitar: interfaces genericas o corporativas, oscuras, infantiles o saturadas; colores decorativos sin funcion; botones que compiten; plantillas SaaS sin identidad.

## 2. Tokens semanticos

Todos los tokens de paleta son los valores exactos de Tailwind v4 (`oklch`), verificados contra `node_modules/tailwindcss/theme.css`. Tailwind genera utilidades como `bg-surface`, `text-fg-muted`, `border-danger-border`.

| Token | Valor | Origen | Uso |
|---|---|---|---|
| `fg-strong` | `oklch(14.7% 0.004 49.25)` | stone-950 | Titulos y texto de maximo enfasis |
| `fg` | `oklch(21.6% 0.006 56.043)` | stone-900 | Texto principal |
| `fg-secondary` | `oklch(37.4% 0.01 67.558)` | stone-700 | Texto secundario fuerte, etiquetas de formulario |
| `fg-muted` | `oklch(44.4% 0.011 73.639)` | stone-600 | Metadatos legibles, subtitulos |
| `fg-subtle` | `oklch(55.3% 0.013 58.071)` | stone-500 | Texto terciario, placeholders, iconos neutros (4.81:1 sobre blanco) |
| `fg-disabled` | `oklch(70.9% 0.01 56.259)` | stone-400 | Solo controles deshabilitados y decoracion. NO es texto legible (2.59:1) |
| `surface` | `#ffffff` | white | Fondo de paneles, tarjetas, inputs |
| `surface-muted` | `oklch(98.5% 0.001 106.423)` | stone-50 | Cabeceras de tabla, zonas de apoyo, hover suave |
| `surface-sunken` | `oklch(97% 0.001 106.424)` | stone-100 | Fondos hundidos, pistas de barra, estados pulsados |
| `border-subtle` | `oklch(97% 0.001 106.424)` | stone-100 | Separadores internos y divisores de lista |
| `border` | `oklch(92.3% 0.003 48.717)` | stone-200 | Borde por defecto de tarjetas e inputs |
| `border-strong` | `oklch(86.9% 0.005 56.366)` | stone-300 | Borde de control en hover y elementos de UI no textuales |
| `border-input` | `oklch(64% 0.011 58)` | nuevo | Borde de campos (Input, Select, Textarea, PasswordInput, DatePicker, TimePicker): 3.37:1 sobre blanco y 3.23:1 sobre surface-muted (WCAG 1.4.11) |
| `danger` | `oklch(57.7% 0.245 27.325)` | red-600 | Error: texto sobre blanco (4.76:1), iconos, bordes de campo invalido |
| `danger-strong` | `oklch(50.5% 0.213 27.518)` | red-700 | Error sobre fondo danger-subtle (5.88:1), hover de accion destructiva |
| `danger-subtle` | `oklch(97.1% 0.013 17.38)` | red-50 | Fondo de aviso o error |
| `danger-border-subtle` | `oklch(93.6% 0.032 17.717)` | red-100 | Borde suave de aviso de error |
| `danger-border` | `oklch(88.5% 0.062 18.334)` | red-200 | Borde de aviso de error |
| `success` | `oklch(59.6% 0.145 163.225)` | emerald-600 | Iconos y puntos de estado correcto (no texto: 3.67:1) |
| `success-solid` | `oklch(50.8% 0.118 165.612)` | emerald-700 | Fondo solido de accion correcta con texto blanco (5.37:1) |
| `success-fg` | `oklch(50.8% 0.118 165.612)` | emerald-700 | Texto de estado correcto (5.05:1 sobre blanco) |
| `success-strong` | `oklch(43.2% 0.095 166.913)` | emerald-800 | Texto correcto sobre success-subtle (7.19:1) |
| `success-subtle` | `oklch(97.9% 0.021 166.113)` | emerald-50 | Fondo de estado correcto |
| `success-border-subtle` | `oklch(95% 0.052 163.051)` | emerald-100 | Borde suave de estado correcto |
| `success-border` | `oklch(90.5% 0.093 164.15)` | emerald-200 | Borde de estado correcto |
| `warning` | `oklch(66.6% 0.179 58.318)` | amber-600 | Iconos y puntos de aviso (no texto: 3.19:1) |
| `warning-fg` | `oklch(55.5% 0.163 48.998)` | amber-700 | Texto de aviso (5.05:1 sobre blanco) |
| `warning-strong` | `oklch(47.3% 0.137 46.201)` | amber-800 | Texto de aviso sobre warning-subtle (6.88:1) |
| `warning-subtle` | `oklch(98.7% 0.022 95.277)` | amber-50 | Fondo de aviso |
| `warning-border` | `oklch(92.4% 0.12 95.746)` | amber-200 | Borde de aviso |
| `info` | `oklch(58.8% 0.158 241.966)` | sky-600 | Iconos y puntos informativos (no texto: 4.02:1) |
| `info-fg` | `oklch(50% 0.134 242.749)` | sky-700 | Texto informativo (5.85:1 sobre blanco) |
| `info-strong` | `oklch(44.3% 0.11 240.79)` | sky-800 | Texto informativo sobre info-subtle (7.05:1) |
| `info-subtle` | `oklch(97.7% 0.013 236.62)` | sky-50 | Fondo informativo |
| `info-border` | `oklch(90.1% 0.058 230.902)` | sky-200 | Borde informativo |
| `accent` | `oklch(58.6% 0.253 17.585)` | rose-600 | Acento no operativo (4.51:1 sobre blanco). Sobre accent-subtle usar accent-strong |
| `accent-strong` | `oklch(51.4% 0.222 16.935)` | rose-700 | Texto de acento sobre accent-subtle (5.51:1), hover |
| `accent-subtle` | `oklch(96.9% 0.015 12.422)` | rose-50 | Fondo de acento suave |
| `accent-border` | `oklch(94.1% 0.03 12.58)` | rose-100 | Borde de acento suave |
| `chart-1` | `#7c3aed` | hex | Serie de grafico 1 (violeta fijo, no cambia con el tema del salon) |
| `chart-2` | `#38bdf8` | hex | Serie de grafico 2 |
| `chart-3` | `#14b8a6` | hex | Serie de grafico 3 |
| `chart-4` | `#f59e0b` | hex | Serie de grafico 4 |
| `chart-5` | `#ec4899` | hex | Serie de grafico 5 |
| `chart-success` | `#16a34a` | hex | Serie positiva (ingresos) en reportes |
| `chart-success-soft` | `#86efac` | hex | Relleno de serie positiva |
| `chart-danger` | `#ef4444` | hex | Serie negativa (gastos) en reportes |
| `chart-danger-soft` | `#fca5a5` | hex | Relleno de serie negativa |
| `chart-info` | `#0ea5e9` | hex | Serie informativa en reportes |
| `chart-info-soft` | `#7dd3fc` | hex | Relleno de serie informativa |

Tokens que no se tocan: `brand-*` (acento por salon, cambia con `[data-theme]`) y `choco-*`.

## 3. Reglas de uso

- Texto: nunca `fg-disabled` ni `warning`/`success`/`info`/`danger` (version base) como texto. Usar `*-fg` o `*-strong`.
- Texto sobre fondo subtil: `danger-strong`, `success-strong`, `warning-strong`, `info-strong`, `accent-strong`. Texto de error sobre `danger-subtle` con `danger` falla (4.36:1).
- Texto `fg-subtle` (4.81:1 sobre blanco) sobre `surface-sunken` baja a 4.41:1: no usarlo sobre stone-100; usar `fg-muted`.
- Estado nunca solo con color: siempre icono + texto (ver StatusBadge).
- Accesibilidad WCAG AA: texto normal 4.5:1, texto grande y UI no textual 3:1.
- Pendiente (deuda de accesibilidad): el borde de campos (`border`, `border-strong`) no alcanza 3:1 (criterio 1.4.11). Decision de diseno pendiente antes de tocar componentes.
- Movil: 375px sin scroll horizontal, gutter lateral 16px, objetivos tactiles de 44px.

## 4. Tipografia

Escala permitida: `text-xs` (12/16), `text-sm` (14/20), `text-base` (16/24), `text-lg` (18/28), `text-xl` (20/28), `text-2xl` (24/32). Minimo visible: 12px.

Reglas de conversion aplicadas en la tabla de mapeo:

| Clase actual | Usos | Destino | Nota |
|---|---|---|---|
| `text-3xl` | 10 | `text-2xl` | Titulos grandes pasan a 2xl |
| `text-5xl` | 1 | `text-2xl` | 3xl+ se reduce a 2xl |
| `text-[10px]` | 25 | `text-xs` | Regla: el tamano permitido mas cercano; 10px sube a 12px. Revisar densidad del calendario |
| `text-[9px]` | 1 | `text-xs` | Idem |
| `text-[11px]` | 18 | `text-xs` | Idem |
| `text-[13px]` | 1 | `text-sm` | Empate entre 12 y 14: se sube a sm |

Pesos permitidos: `font-normal` (400), `font-medium` (500), `font-semibold` (600).

| Clase actual | Usos | Destino |
|---|---|---|
| `font-bold` | 101 | `font-semibold` |
| `font-extrabold` / `font-black` | 0 | `font-semibold` |
| `font-light` / `font-thin` | 0 | `font-normal` |

## 5. Componentes compartidos

Viven en `src/components/ui/`. Son componentes de servidor salvo `DataTable` (`"use client"`, paginación local). Usan tokens semánticos: las pantallas no repiten clases de paleta cruda para estos patrones.

- **PageHeader** (`page-header.tsx`): cabecera de pantalla. Props: `title` (ReactNode, va dentro del único `h1`, `text-2xl font-semibold text-fg-strong`), `description?` (`text-sm text-fg-muted`), `actions?`. Las acciones van a la derecha en escritorio y se apilan bajo el título en móvil. Una por pantalla.
- **Panel** (`panel.tsx`): sección con `bg-surface border border-border rounded-xl`. Props: `title?` (h2 `text-base font-semibold text-fg-strong`), `actions?`, `className?`, `children`. Úsalo para agrupar un bloque (tabla, lista, formulario) dentro de una pantalla.
- **MetricCard** (`metric-card.tsx`): indicador numérico. Props: `label` (`text-sm text-fg-muted`), `value` (`text-2xl font-semibold`), `tone?` (`default`, `success`, `warning`, `danger`; solo colorea el valor), `help?` (`text-xs text-fg-subtle`), `trend?` (`{ direction: "up" | "down" | "flat", label, tone?: "positive" | "negative" | "neutral" }`). La tendencia siempre lleva icono y texto. Úsalo para totales y KPIs.
- **StatusBadge** (`status-badge.tsx`): estado con icono y texto, nunca solo color. Props: `variant` (`success`, `warning`, `danger`, `info`, `accent`, `neutral`; usa `*-subtle` de fondo, `*-border` de borde y `*-strong` de texto) y `label`. `STOCK_STATUS_BADGES` mapea `ok | low | empty` a `{ variant, label }` con los textos que muestra la app (`Disponible`, `Stock bajo`, `Agotado`); se espera `<StatusBadge {...STOCK_STATUS_BADGES[status]} />`. Los mapas de citas, suscripciones e invitaciones se añadirán junto a su primer consumidor.
- **DataTable** (`data-table.tsx`): tabla genérica. Props: `label` (nombre accesible), `columns` (`{ id, header, cell(row), secondary?, align?: "left" | "right" }`), `rows`, `getRowId(row)` y `emptyMessage`. Filas de 52px (`h-13`), 10 filas por página con controles "Página anterior" y "Página siguiente" (solo si hay más de 10 filas), cabecera `bg-surface-muted text-sm font-semibold text-fg-muted`, sin scroll horizontal en 375px. Por debajo de `sm` las columnas `secondary` se muestran como segunda línea `text-sm text-fg-muted` bajo la primera columna. Las acciones van en una columna propia no secundaria para seguir visibles en móvil.
- Pantallas de referencia: Clientes (`customers/customers-client.tsx` y `customers-list.tsx`: PageHeader y DataTable) e Inventario (`inventory/`: PageHeader, Panel, MetricCard, DataTable y StatusBadge).

## 6. Excepciones de hex y rgba

- Paletas de salon (`[data-theme]` en `globals.css`) y `swatches` de `salon/salon-settings.tsx`: son catalogo de datos, se mantienen.
- Relleno `#1c1917` en `monthly-appointments-chart.tsx` y `reports/report-charts.tsx`: equivale a `fg`; migrar a `var(--color-fg)` en SVG.
- Colores de `reports/reports-view.tsx` y `PRODUCT_COLORS` de `reports/report-charts.tsx`: pasan a `chart-*`.
- Confeti de `appointments/dialogs/complete-appointment.tsx` (`#22C55E`, `#38BDF8`, `#FACC15`, `#F472B6`): decorativo, excepcion documentada.
- Sombras: ya no hay excepcion. Se usan los tokens `--shadow-*` de `globals.css` (tabla siguiente). Los grupos marcados con "≈" unifican valores con diferencias imperceptibles (alfa ±0.02 o difuminado ±2px).
- Fondo de acceso `bg-[linear-gradient(180deg,#fbf8ff_0%,#ffffff_48%,#f8fafc_100%)]`: utilidad `bg-auth-backdrop` (definida con `@utility` en `globals.css`).

| Sombra arbitraria actual | Token |
|---|---|
| `shadow-[0_1px_2px_rgba(15,23,42,0.04)]`, `shadow-[0_1px_4px_rgba(0,0,0,0.05)]` ≈ | `shadow-hairline` |
| `shadow-[0_1px_8px_rgba(0,0,0,0.04)]` | `shadow-topbar` |
| `shadow-[1px_0_8px_rgba(0,0,0,0.04)]` | `shadow-sidebar` |
| `shadow-[6px_0_12px_rgba(15,23,42,0.04)]` | `shadow-sticky` |
| `shadow-[0_2px_8px_rgba(0,0,0,0.05)]`, `...0.06)]`, `...0.07)]`, `shadow-[0_2px_10px_rgba(15,23,42,0.06)]` ≈ | `shadow-soft` |
| `shadow-[0_2px_8px_rgba(0,0,0,0.07),0_0_1px_rgba(124,58,237,0.08)]` | `shadow-card` |
| `shadow-[0_2px_12px_rgba(0,0,0,0.08)]`, `shadow-[0_2px_12px_rgba(0,0,0,0.07)]` ≈ | `shadow-tile` |
| `shadow-[0_4px_12px_rgba(0,0,0,0.10)]` | `shadow-hover` |
| `shadow-[0_3px_10px_rgba(0,0,0,0.18)]` | `shadow-lift` |
| `shadow-[0_8px_24px_rgba(28,25,23,0.16)]`, `shadow-[0_10px_28px_rgba(28,25,23,0.18)]`, `shadow-[0_12px_28px_rgba(15,23,42,0.16)]` ≈ | `shadow-popover` |
| `shadow-[0_18px_42px_rgba(15,23,42,0.18),0_2px_8px_rgba(15,23,42,0.08)]` | `shadow-dropdown` |
| `shadow-[0_6px_20px_rgba(0,0,0,0.22)]`, `shadow-[0_8px_30px_rgba(0,0,0,0.18)]` ≈ | `shadow-floating` |
| `shadow-[0_20px_60px_rgba(76,29,149,0.10),0_2px_8px_rgba(15,23,42,0.05)]` | `shadow-auth-card` |
| `shadow-[0_10px_24px_rgba(124,58,237,0.28)]` | `shadow-brand` |
| `shadow-[0_4px_14px_rgba(124,58,237,0.35)]` | `shadow-brand-sm` |
| `shadow-[0_4px_16px_rgba(124,58,237,0.12)]` | `shadow-brand-hover` |
| `shadow-[0_2px_12px_rgba(124,58,237,0.08)]`, `shadow-[0_1px_4px_rgba(109,40,217,0.08)]` ≈ | `shadow-brand-soft` |
| `shadow-[0_2px_6px_rgba(16,185,129,0.08)]` | `shadow-success-soft` |
| `shadow-[0_0_0_2px_rgba(124,58,237,0.15)]` | `shadow-focus` |
| `shadow-[0_0_0_4px_rgba(124,58,237,0.15)]` | `shadow-focus-lg` |

Las variantes (`hover:`, `focus:`, `group-hover:`...) se conservan: `hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]` pasa a `hover:shadow-hover`.

## 7. Tabla de mapeo completa

Inventario: 1607 usos de paleta cruda en 157 clases unicas (conteo del script). Cada clase base se mapea a un token; la variante (`hover:`, `focus:`, `disabled:`, `placeholder:`, `focus-visible:`) se conserva.

| Clase actual | Usos | Token | Estado / nota |
|---|---|---|---|
| `text-stone-500` | 239 | `text-fg-subtle` | exacto |
| `border-stone-200` | 83 | `border-border` | exacto |
| `text-neutral-500` | 81 | `text-fg-subtle` | neutral a stone |
| `text-stone-900` | 74 | `text-fg` | exacto |
| `text-red-600` | 61 | `text-danger` | Sobre bg-red-50 falla (4.36:1): usar danger-strong en esos casos |
| `bg-red-50` | 59 | `bg-danger-subtle` | exacto |
| `text-stone-600` | 49 | `text-fg-muted` | exacto |
| `text-stone-700` | 46 | `text-fg-secondary` | exacto |
| `text-stone-800` | 42 | `text-fg-secondary` | Aclara leve (800 pasa a 700) |
| `text-stone-400` | 39 | `text-fg-subtle` | AA: 2.59:1 no legible; sube a fg-subtle (4.81:1) |
| `bg-stone-50` | 36 | `bg-surface-muted` | exacto |
| `text-emerald-700` | 36 | `text-success-fg` | exacto |
| `bg-emerald-50` | 33 | `bg-success-subtle` | exacto |
| `border-red-200` | 29 | `border-danger-border` | exacto |
| `border-stone-100` | 29 | `border-border-subtle` | exacto |
| `text-stone-950` | 27 | `text-fg-strong` | exacto |
| `hover:bg-stone-50` | 26 | `hover:bg-surface-muted` | exacto |
| `bg-amber-50` | 25 | `bg-warning-subtle` | exacto |
| `text-neutral-900` | 25 | `text-fg` | neutral a stone |
| `border-neutral-200` | 24 | `border-border` | neutral a stone |
| `text-emerald-600` | 21 | `text-success-fg` | AA: 3.67:1 falla como texto; pasa a success-fg (5.05:1) |
| `bg-stone-100` | 19 | `bg-surface-sunken` | exacto |
| `text-amber-700` | 18 | `text-warning-fg` | exacto |
| `text-neutral-700` | 17 | `text-fg-secondary` | neutral a stone |
| `text-red-700` | 17 | `text-danger-strong` | exacto |
| `border-amber-200` | 16 | `border-warning-border` | exacto |
| `bg-neutral-50` | 15 | `bg-surface-muted` | neutral a stone |
| `border-neutral-100` | 14 | `border-border-subtle` | neutral a stone |
| `text-amber-600` | 14 | `text-warning-fg` | AA: 3.19:1 falla como texto; pasa a warning-fg (5.05:1) |
| `text-stone-300` | 14 | `text-fg-disabled` | Solo deshabilitado o decorativo (no es texto legible) |
| `border-emerald-200` | 13 | `border-success-border` | exacto |
| `hover:text-stone-900` | 13 | `hover:text-fg` | exacto |
| `text-amber-800` | 12 | `text-warning-strong` | exacto |
| `border-red-100` | 11 | `border-danger-border-subtle` | exacto |
| `hover:bg-red-50` | 10 | `hover:bg-danger-subtle` | exacto |
| `text-neutral-600` | 10 | `text-fg-muted` | neutral a stone |
| `text-neutral-950` | 10 | `text-fg-strong` | neutral a stone |
| `border-stone-300` | 9 | `border-border-strong` | exacto |
| `divide-stone-100` | 9 | `divide-border-subtle` | exacto |
| `hover:border-stone-300` | 8 | `hover:border-border-strong` | exacto |
| `hover:text-stone-800` | 8 | `hover:text-fg-secondary` | Aclara leve (800 pasa a 700) |
| `text-rose-600` | 8 | `text-accent` | exacto |
| `divide-neutral-100` | 7 | `divide-border-subtle` | neutral a stone |
| `text-amber-500` | 7 | `text-warning` | AA: falla como texto; solo icono (warning) |
| `bg-neutral-100` | 6 | `bg-surface-sunken` | neutral a stone |
| `border-red-400` | 6 | `border-danger` | cambio de tono |
| `text-emerald-500` | 6 | `text-success-fg` | AA: falla como texto; success-fg (si es solo icono, success) |
| `text-rose-700` | 6 | `text-accent-strong` | exacto |
| `bg-emerald-500` | 5 | `bg-success` | cambio de tono |
| `bg-rose-50` | 5 | `bg-accent-subtle` | exacto |
| `disabled:bg-stone-50` | 5 | `disabled:bg-surface-muted` | exacto |
| `disabled:text-stone-400` | 5 | `disabled:text-fg-subtle` | AA: 2.59:1 no legible; sube a fg-subtle (4.81:1) |
| `focus:ring-red-500` | 5 | `focus:ring-danger` | cambio de tono |
| `placeholder:text-stone-400` | 5 | `placeholder:text-fg-subtle` | AA: 2.59:1 no legible; sube a fg-subtle (4.81:1) |
| `text-emerald-900` | 5 | `text-success-strong` | cambio de tono |
| `text-neutral-400` | 5 | `text-fg-subtle` | neutral a stone; AA: sube a fg-subtle (4.81:1) |
| `bg-amber-100` | 4 | `bg-warning-subtle` | cambio de tono |
| `bg-amber-400` | 4 | `bg-warning` | cambio de tono |
| `bg-blue-50` | 4 | `bg-info-subtle` | Matiz azul a info-subtle |
| `bg-emerald-100` | 4 | `bg-success-subtle` | cambio de tono |
| `disabled:border-neutral-100` | 4 | `disabled:border-border-subtle` | neutral a stone |
| `disabled:text-neutral-300` | 4 | `disabled:text-fg-disabled` | neutral a stone; Solo deshabilitado o decorativo |
| `fill-stone-400` | 4 | `fill-fg-subtle` | cambio de tono |
| `hover:bg-neutral-50` | 4 | `hover:bg-surface-muted` | neutral a stone |
| `hover:text-neutral-900` | 4 | `hover:text-fg` | neutral a stone |
| `hover:text-red-500` | 4 | `hover:text-danger` | AA: 3.76:1 falla como texto; pasa a danger (4.76:1) |
| `text-emerald-800` | 4 | `text-success-strong` | exacto |
| `text-sky-700` | 4 | `text-info-fg` | exacto |
| `bg-sky-50` | 3 | `bg-info-subtle` | exacto |
| `border-emerald-100` | 3 | `border-success-border-subtle` | exacto |
| `hover:bg-stone-100` | 3 | `hover:bg-surface-sunken` | exacto |
| `hover:text-red-600` | 3 | `hover:text-danger` | Sobre bg-red-50 falla (4.36:1): usar danger-strong en esos casos |
| `text-amber-900` | 3 | `text-warning-strong` | cambio de tono |
| `text-blue-700` | 3 | `text-info-fg` | Matiz azul a info-fg |
| `text-rose-500` | 3 | `text-accent` | AA: rose-500 < 4.5:1; pasa a accent (4.51:1) |
| `bg-blue-500` | 2 | `bg-info` | Matiz azul a info |
| `bg-emerald-600` | 2 | `bg-success-solid` | Solido con texto blanco: success-solid (5.37:1) |
| `bg-neutral-900` | 2 | `bg-fg` | neutral a stone |
| `bg-pink-50` | 2 | `bg-accent-subtle` | Matiz rosa a accent-subtle |
| `bg-red-100` | 2 | `bg-danger-subtle` | cambio de tono |
| `bg-red-500` | 2 | `bg-danger` | Solido: danger (texto blanco 4.76:1) |
| `bg-stone-200` | 2 | `bg-border` | exacto |
| `bg-stone-400` | 2 | `bg-fg-subtle` | cambio de tono |
| `bg-stone-900` | 2 | `bg-fg` | exacto |
| `border-amber-400` | 2 | `border-warning` | cambio de tono |
| `border-blue-200` | 2 | `border-info-border` | cambio de tono |
| `border-rose-100` | 2 | `border-accent-border` | exacto |
| `disabled:text-stone-300` | 2 | `disabled:text-fg-disabled` | Solo deshabilitado o decorativo (no es texto legible) |
| `fill-stone-300` | 2 | `fill-border-strong` | exacto |
| `focus-visible:ring-stone-400` | 2 | `focus-visible:ring-fg-subtle` | cambio de tono |
| `focus:ring-rose-500` | 2 | `focus:ring-accent` | cambio de tono |
| `hover:bg-emerald-100` | 2 | `hover:bg-success-subtle` | cambio de tono |
| `hover:bg-green-50` | 2 | `hover:bg-success-subtle` | Matiz verde a success-subtle |
| `hover:bg-neutral-100` | 2 | `hover:bg-surface-sunken` | neutral a stone |
| `hover:border-neutral-300` | 2 | `hover:border-border-strong` | neutral a stone |
| `hover:text-neutral-800` | 2 | `hover:text-fg-secondary` | neutral a stone; Aclara leve (800 pasa a 700) |
| `placeholder:text-stone-500` | 2 | `placeholder:text-fg-subtle` | exacto |
| `text-blue-600` | 2 | `text-info-fg` | Matiz azul a info; AA: pasa a info-fg (5.85:1) |
| `text-green-700` | 2 | `text-success-fg` | Matiz verde a success-fg |
| `text-neutral-300` | 2 | `text-fg-disabled` | neutral a stone; Solo deshabilitado o decorativo |
| `text-neutral-800` | 2 | `text-fg-secondary` | neutral a stone; Aclara leve (800 pasa a 700) |
| `text-pink-600` | 2 | `text-accent` | Matiz rosa a accent |
| `text-red-500` | 2 | `text-danger` | AA: 3.76:1 falla como texto; pasa a danger (4.76:1) |
| `text-stone-200` | 2 | `text-fg-disabled` | Solo deshabilitado o decorativo |
| `bg-amber-500` | 1 | `bg-warning` | cambio de tono |
| `bg-blue-100` | 1 | `bg-info-subtle` | cambio de tono |
| `bg-emerald-400` | 1 | `bg-success` | cambio de tono |
| `bg-neutral-300` | 1 | `bg-border-strong` | neutral a stone |
| `bg-neutral-400` | 1 | `bg-fg-subtle` | neutral a stone |
| `bg-red-300` | 1 | `bg-danger-border` | cambio de tono |
| `bg-red-600` | 1 | `bg-danger` | Solido: danger (texto blanco 4.76:1) |
| `bg-rose-100` | 1 | `bg-accent-subtle` | cambio de tono |
| `bg-rose-500` | 1 | `bg-accent` | cambio de tono |
| `bg-rose-600` | 1 | `bg-accent` | exacto |
| `bg-sky-400` | 1 | `bg-info` | cambio de tono |
| `bg-stone-700` | 1 | `bg-fg-secondary` | exacto |
| `border-amber-100` | 1 | `border-warning-border` | cambio de tono |
| `border-amber-500` | 1 | `border-warning` | cambio de tono |
| `border-blue-400` | 1 | `border-info` | cambio de tono |
| `border-emerald-400` | 1 | `border-success` | cambio de tono |
| `border-green-200` | 1 | `border-success-border` | cambio de tono |
| `border-l-amber-400` | 1 | `border-l-warning` | cambio de tono |
| `border-l-blue-400` | 1 | `border-l-info` | cambio de tono |
| `border-l-emerald-400` | 1 | `border-l-success` | cambio de tono |
| `border-l-stone-300` | 1 | `border-l-border-strong` | exacto |
| `border-neutral-900` | 1 | `border-fg` | neutral a stone |
| `border-pink-100` | 1 | `border-accent-border` | cambio de tono |
| `border-rose-600` | 1 | `border-accent` | exacto |
| `fill-emerald-300` | 1 | `fill-success` | cambio de tono |
| `fill-red-300` | 1 | `fill-danger-border` | cambio de tono |
| `focus-visible:ring-red-600` | 1 | `focus-visible:ring-danger` | exacto |
| `focus-visible:ring-stone-900` | 1 | `focus-visible:ring-fg` | exacto |
| `focus:border-red-500` | 1 | `focus:border-danger` | cambio de tono |
| `focus:ring-emerald-400` | 1 | `focus:ring-success` | cambio de tono |
| `focus:ring-pink-500` | 1 | `focus:ring-accent` | cambio de tono |
| `focus:ring-red-100` | 1 | `focus:ring-danger-subtle` | cambio de tono |
| `hover:bg-emerald-200` | 1 | `hover:bg-success-border` | exacto |
| `hover:bg-emerald-600` | 1 | `hover:bg-success-solid` | Solido con texto blanco: success-solid (5.37:1) |
| `hover:bg-emerald-700` | 1 | `hover:bg-success-solid` | Solido con texto blanco: success-solid |
| `hover:bg-red-700` | 1 | `hover:bg-danger-strong` | exacto |
| `hover:bg-rose-50` | 1 | `hover:bg-accent-subtle` | exacto |
| `hover:bg-rose-700` | 1 | `hover:bg-accent-strong` | exacto |
| `hover:bg-stone-800` | 1 | `hover:bg-fg-secondary` | cambio de tono |
| `hover:border-neutral-200` | 1 | `hover:border-border` | neutral a stone |
| `hover:text-neutral-400` | 1 | `hover:text-fg-subtle` | neutral a stone; AA: sube a fg-subtle (4.81:1) |
| `hover:text-neutral-600` | 1 | `hover:text-fg-muted` | neutral a stone |
| `hover:text-red-700` | 1 | `hover:text-danger-strong` | exacto |
| `hover:text-rose-700` | 1 | `hover:text-accent-strong` | exacto |
| `hover:text-stone-200` | 1 | `hover:text-fg-disabled` | Solo deshabilitado o decorativo |
| `hover:text-stone-500` | 1 | `hover:text-fg-subtle` | exacto |
| `hover:text-stone-700` | 1 | `hover:text-fg-secondary` | exacto |
| `placeholder:text-neutral-400` | 1 | `placeholder:text-fg-subtle` | neutral a stone; AA: sube a fg-subtle (4.81:1) |
| `placeholder:text-neutral-500` | 1 | `placeholder:text-fg-subtle` | neutral a stone |
| `text-blue-900` | 1 | `text-info-strong` | Matiz azul a info-strong |
| `text-pink-500` | 1 | `text-accent` | Matiz rosa a accent |
| `text-red-800` | 1 | `text-danger-strong` | cambio de tono |
| `text-sky-600` | 1 | `text-info-fg` | AA: 4.02:1 falla como texto; pasa a info-fg (5.85:1) |
