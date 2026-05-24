-- Per-salon color theme key. Drives the accent palette (buttons, borders, links)
-- across the dashboard via a [data-theme] wrapper. Background stays white.
-- 'violet' is the default so existing salons look unchanged.
alter table salons
  add column if not exists theme text not null default 'violet';
