-- Permite archivar categorias de servicios sin destruir historial.
-- Los servicios y citas conservan sus referencias a la categoria antigua,
-- pero el salon puede crear una nueva categoria activa con el mismo nombre.

alter table service_categories
  drop constraint if exists service_categories_salon_id_name_key;

create unique index if not exists uq_service_categories_active_name_per_salon
  on service_categories (salon_id, name)
  where is_active = true;
