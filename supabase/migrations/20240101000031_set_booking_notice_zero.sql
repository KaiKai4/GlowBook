-- Remove the 60-minute appointment lead-time behavior from configured salons.
-- The column remains for future product settings, but it no longer defaults to
-- a blocking value and existing salons are reset to immediate booking.

alter table salons
  alter column min_booking_notice_minutes set default 0;

update salons
set min_booking_notice_minutes = 0
where min_booking_notice_minutes <> 0;
