-- Atomic RPC to create an appointment with its items in a single transaction.
-- The exclusion constraint on appointment_items guarantees no double-booking.
create or replace function create_appointment(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_appt_id uuid;
  v_item jsonb;
begin
  -- Insert appointment header
  insert into appointments (
    salon_id, customer_id, created_by, notes, status
  ) values (
    (payload ->> 'salon_id')::uuid,
    (payload ->> 'customer_id')::uuid,
    (payload ->> 'created_by')::uuid,
    coalesce(payload ->> 'notes', ''),
    'scheduled'
  ) returning id into v_appt_id;

  -- Insert all items (exclusion constraint will reject overlapping bookings)
  for v_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    insert into appointment_items (
      salon_id, appointment_id, service_id, employee_id,
      start_time, end_time, duration_minutes, price,
      ordering, blocks_calendar
    ) values (
      (v_item ->> 'salon_id')::uuid,
      v_appt_id,
      (v_item ->> 'service_id')::uuid,
      (v_item ->> 'employee_id')::uuid,
      (v_item ->> 'start_time')::timestamptz,
      (v_item ->> 'end_time')::timestamptz,
      (v_item ->> 'duration_minutes')::int,
      (v_item ->> 'price')::numeric,
      (v_item ->> 'ordering')::int,
      coalesce((v_item ->> 'blocks_calendar')::boolean, true)
    );
  end loop;

  -- The recalc_appointment trigger will set start_time, end_time, total_price automatically.
  return v_appt_id;
end $$;
