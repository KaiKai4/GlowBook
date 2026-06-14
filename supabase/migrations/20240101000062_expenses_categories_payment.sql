-- Gastos: categorias reales + comprobante opcional.
-- Hasta ahora todo gasto se guardaba como category='other' y el texto libre
-- iba a custom_category; la taxonomia existia pero no se usaba. Esto la activa
-- con categorias propias de un salon y mantiene custom_category para el caso
-- "personalizado".

-- 1) Ampliar el set de categorias (el viejo check solo tenia 6 genericas).
alter table expenses drop constraint if exists expenses_category_check;
alter table expenses
  add constraint expenses_category_check
  check (category in (
    'rent',           -- Alquiler
    'utilities',      -- Servicios basicos (luz, agua, internet)
    'products',       -- Productos e insumos (tintes, shampoo, etc.)
    'tools',          -- Herramientas y equipo
    'payroll',        -- Salarios
    'commissions',    -- Comisiones
    'marketing',      -- Publicidad y marketing
    'maintenance',    -- Mantenimiento y reparaciones
    'taxes',          -- Impuestos
    'supplies',       -- Suministros varios
    'other'           -- Otro / personalizado
  ));

-- 2) Comprobante opcional (URL en storage o enlace externo).
alter table expenses
  add column if not exists receipt_url text;

-- Indice para las metricas por categoria del periodo.
create index if not exists idx_expenses_salon_category
  on expenses (salon_id, category, expense_date desc);
