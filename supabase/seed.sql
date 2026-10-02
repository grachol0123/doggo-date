-- Local/CI-only seed data. Loaded by `supabase db reset` per [db.seed] in config.toml —
-- NEVER applied by `supabase db push` to a linked remote project, unlike files under
-- supabase/migrations/. Keep any fixture that creates real auth.users accounts with
-- known passwords here, not in a timestamped migration.
--
-- Seed two dedicated authz test accounts/dogs for the Phase 3 HTTP authorization script.
-- Kept separate from the gen1..gen20 demo-QA seed so automated fixtures stay stable and explicit.
--
-- Test account password (both accounts): AuthzTestPassw0rd!
do $$
declare
  owner_a_user_id uuid := '77777777-7777-4777-8777-777777777777'::uuid;
  owner_b_user_id uuid := '88888888-8888-4888-8888-888888888888'::uuid;
  owner_a_email text := 'authz-owner-a@doggo-date.test';
  owner_b_email text := 'authz-owner-b@doggo-date.test';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
    phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    banned_until, reauthentication_token, reauthentication_sent_at,
    is_sso_user, deleted_at, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    owner_a_user_id,
    'authenticated',
    'authenticated',
    owner_a_email,
    extensions.crypt('AuthzTestPassw0rd!', extensions.gen_salt('bf')),
    now(), null, '', null,
    '', null, '', '',
    null, null,
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', 'Authz Owner A'),
    false, now(), now(), null, null,
    '', '', null,
    '', 0,
    null, '', null,
    false, null, false
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    owner_a_user_id::text,
    owner_a_user_id,
    jsonb_build_object('sub', owner_a_user_id::text, 'email', owner_a_email),
    'email',
    now(), now(), now()
  );

  insert into public.dogs (
    owner_id, name, age_years, description, breed, activity_level, interests
  ) values (
    owner_a_user_id,
    'Authz Owner A Dog',
    4,
    'Dedicated authorization test fixture for owner A.',
    'Labrador',
    'walker'::public.dog_activity_level,
    array['walks'::public.dog_interest, 'fetch'::public.dog_interest]
  );

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
    phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    banned_until, reauthentication_token, reauthentication_sent_at,
    is_sso_user, deleted_at, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    owner_b_user_id,
    'authenticated',
    'authenticated',
    owner_b_email,
    extensions.crypt('AuthzTestPassw0rd!', extensions.gen_salt('bf')),
    now(), null, '', null,
    '', null, '', '',
    null, null,
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', 'Authz Owner B'),
    false, now(), now(), null, null,
    '', '', null,
    '', 0,
    null, '', null,
    false, null, false
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    owner_b_user_id::text,
    owner_b_user_id,
    jsonb_build_object('sub', owner_b_user_id::text, 'email', owner_b_email),
    'email',
    now(), now(), now()
  );

  insert into public.dogs (
    owner_id, name, age_years, description, breed, activity_level, interests
  ) values (
    owner_b_user_id,
    'Authz Owner B Dog',
    6,
    'Dedicated authorization test fixture for owner B.',
    'Beagle',
    'runner'::public.dog_activity_level,
    array['running'::public.dog_interest, 'hiking'::public.dog_interest]
  );
end $$;
