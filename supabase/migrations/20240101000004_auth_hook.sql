-- Custom Access Token Hook: injects salon_id claim into the JWT.
-- Register this function in Supabase Dashboard → Auth → Hooks → Custom Access Token.
-- The claim is stable (salon doesn't change) so it's safe to carry in the token.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb;
  v_salon_id uuid;
begin
  claims := event -> 'claims';

  select salon_id into v_salon_id
    from profiles
    where id = (event ->> 'user_id')::uuid;

  if v_salon_id is not null then
    claims := jsonb_set(claims, '{salon_id}', to_jsonb(v_salon_id::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end $$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
