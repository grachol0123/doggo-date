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

-- Seed three dedicated message test accounts/dogs for the Playwright E2E messaging specs
-- (tests/e2e/message-realtime-delivery.spec.ts, tests/e2e/message-unauthorized-access-blocked.spec.ts).
-- A and B are pre-matched (fixed match id) so the specs can navigate straight to the thread
-- without driving the swipe flow; C is a deliberately unmatched third owner used to prove the
-- not_participant UI boundary. Fixed ids keep both specs independent of insertion order.
--
-- Test account password (all three accounts): MessageTestPassw0rd!
do $$
declare
  owner_a_user_id uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  owner_b_user_id uuid := 'a0000000-0000-4000-8000-000000000002'::uuid;
  owner_c_user_id uuid := 'a0000000-0000-4000-8000-000000000003'::uuid;
  owner_a_email text := 'message-owner-a@doggo-date.test';
  owner_b_email text := 'message-owner-b@doggo-date.test';
  owner_c_email text := 'message-owner-c@doggo-date.test';
  dog_a_id uuid := 'a0000000-0000-4000-8000-0000000000a1'::uuid;
  dog_b_id uuid := 'a0000000-0000-4000-8000-0000000000a2'::uuid;
  dog_c_id uuid := 'a0000000-0000-4000-8000-0000000000a3'::uuid;
  match_ab_id uuid := 'a0000000-0000-4000-8000-0000000000f1'::uuid;
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
  ) values
    (
      '00000000-0000-0000-0000-000000000000', owner_a_user_id, 'authenticated', 'authenticated',
      owner_a_email, extensions.crypt('MessageTestPassw0rd!', extensions.gen_salt('bf')),
      now(), null, '', null, '', null, '', '', null, null,
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Message Owner A'),
      false, now(), now(), null, null, '', '', null, '', 0, null, '', null, false, null, false
    ),
    (
      '00000000-0000-0000-0000-000000000000', owner_b_user_id, 'authenticated', 'authenticated',
      owner_b_email, extensions.crypt('MessageTestPassw0rd!', extensions.gen_salt('bf')),
      now(), null, '', null, '', null, '', '', null, null,
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Message Owner B'),
      false, now(), now(), null, null, '', '', null, '', 0, null, '', null, false, null, false
    ),
    (
      '00000000-0000-0000-0000-000000000000', owner_c_user_id, 'authenticated', 'authenticated',
      owner_c_email, extensions.crypt('MessageTestPassw0rd!', extensions.gen_salt('bf')),
      now(), null, '', null, '', null, '', '', null, null,
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Message Owner C'),
      false, now(), now(), null, null, '', '', null, '', 0, null, '', null, false, null, false
    );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values
    (
      gen_random_uuid(), owner_a_user_id::text, owner_a_user_id,
      jsonb_build_object('sub', owner_a_user_id::text, 'email', owner_a_email), 'email', now(), now(), now()
    ),
    (
      gen_random_uuid(), owner_b_user_id::text, owner_b_user_id,
      jsonb_build_object('sub', owner_b_user_id::text, 'email', owner_b_email), 'email', now(), now(), now()
    ),
    (
      gen_random_uuid(), owner_c_user_id::text, owner_c_user_id,
      jsonb_build_object('sub', owner_c_user_id::text, 'email', owner_c_email), 'email', now(), now(), now()
    );

  insert into public.dogs (id, owner_id, name, age_years, description, breed, activity_level, interests) values
    (
      dog_a_id, owner_a_user_id, 'Message Owner A Dog', 3,
      'Dedicated messaging E2E fixture for owner A.', 'Collie',
      'walker'::public.dog_activity_level, array['walks'::public.dog_interest]
    ),
    (
      dog_b_id, owner_b_user_id, 'Message Owner B Dog', 5,
      'Dedicated messaging E2E fixture for owner B.', 'Poodle',
      'homebody'::public.dog_activity_level, array['car_rides'::public.dog_interest]
    ),
    (
      dog_c_id, owner_c_user_id, 'Message Owner C Dog', 2,
      'Dedicated messaging E2E fixture for owner C (deliberately unmatched with A/B).', 'Terrier',
      'runner'::public.dog_activity_level, array['running'::public.dog_interest]
    );

  insert into public.matches (id, dog_a_id, dog_b_id)
  values (match_ab_id, dog_a_id, dog_b_id);
end $$;
