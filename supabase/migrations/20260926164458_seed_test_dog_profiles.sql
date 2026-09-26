-- Seed 20 test dog profiles (Gen_1..Gen_20) for manually exercising the browse/swipe UI (dashboard-page / S-02).
-- Each dog needs a backing auth.users row (dogs.owner_id references auth.users(id)), so this migration also
-- creates 20 throwaway test accounts (gen1@doggo-date.test .. gen20@doggo-date.test). Photos are intentionally
-- left null; add them manually afterwards (e.g. via Supabase Studio or the dog-photos bucket).
--
-- Test account password (all 20 accounts): DoggoDateTest123!
do $$
declare
  test_user_id uuid;
  test_email text;
  i int;
  breeds text[] := array[
    'Labrador', 'Buldog francuski', 'Owczarek niemiecki', 'Mieszaniec',
    'Chart wloski', 'Cocker spaniel', 'Beagle', 'Border collie',
    'Jamnik', 'Golden retriever'
  ];
  activity_levels public.dog_activity_level[] := array['homebody', 'walker', 'runner']::public.dog_activity_level[];
  interests_pool public.dog_interest[] := array[
    'walks', 'running', 'fetch', 'swimming', 'agility',
    'obedience_training', 'playing_with_other_dogs', 'hiking', 'camping', 'car_rides'
  ]::public.dog_interest[];
begin
  for i in 1..20 loop
    test_user_id := gen_random_uuid();
    test_email := 'gen' || i || '@doggo-date.test';

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
      test_user_id,
      'authenticated',
      'authenticated',
      test_email,
      extensions.crypt('DoggoDateTest123!', extensions.gen_salt('bf')),
      now(), null, '', null,
      '', null, '', '',
      null, null,
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', 'Gen ' || i || ' Owner'),
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
      test_user_id::text,
      test_user_id,
      jsonb_build_object('sub', test_user_id::text, 'email', test_email),
      'email',
      now(), now(), now()
    );

    insert into public.dogs (
      owner_id, name, age_years, description, breed, activity_level, interests
    ) values (
      test_user_id,
      'Gen_' || i,
      1 + (i % 12),
      'Testowy profil wygenerowany do przegladania i swipe (zdjecie zostanie dodane recznie).',
      breeds[1 + (i % array_length(breeds, 1))],
      activity_levels[1 + (i % array_length(activity_levels, 1))],
      array[
        interests_pool[1 + (i % array_length(interests_pool, 1))],
        interests_pool[1 + ((i + 3) % array_length(interests_pool, 1))]
      ]
    );
  end loop;
end $$;
