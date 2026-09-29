begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, storage, extensions;

select plan(4);

delete from public.matches
where dog_a_id in (
  '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid,
  '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid,
  '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'::uuid
)
or dog_b_id in (
  '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid,
  '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid,
  '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'::uuid
);

delete from public.swipes
where actor_dog_id in (
  '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid,
  '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid,
  '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'::uuid
)
or target_dog_id in (
  '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid,
  '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid,
  '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'::uuid
);

delete from public.dogs
where id in (
  '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid,
  '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid,
  '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'::uuid
);

delete from auth.users
where id in (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
    'authenticated',
    'authenticated',
    'match-owner-a@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
    'authenticated',
    'authenticated',
    'match-owner-b@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
    'authenticated',
    'authenticated',
    'match-owner-c@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.dogs (id, owner_id, name, age_years)
values
  (
    '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
    'Match Dog A',
    3
  ),
  (
    '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
    'Match Dog B',
    4
  ),
  (
    '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'::uuid,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
    'Match Dog C',
    5
  );

insert into public.swipes (actor_dog_id, target_dog_id, decision)
values
  (
    '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid,
    '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid,
    'like'::public.swipe_decision
  ),
  (
    '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid,
    '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid,
    'like'::public.swipe_decision
  );

select results_eq(
  $$
    select count(*)::bigint
    from public.matches
    where dog_a_id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid
      and dog_b_id = '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid
  $$,
  array[1::bigint],
  'Mutual likes create a match fixture for RLS assertions'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select results_eq(
  $$
    select count(*)::bigint
    from public.matches
    where dog_a_id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid
      and dog_b_id = '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid
  $$,
  array[1::bigint],
  'Participant can select their match'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select results_eq(
  $$
    select count(*)::bigint
    from public.matches
    where dog_a_id = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid
      and dog_b_id = '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'::uuid
  $$,
  array[0::bigint],
  'Non-participant cannot select another pair''s match'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.matches (dog_a_id, dog_b_id)
    values (
      '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d'::uuid,
      '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'::uuid
    );
  $$,
  '42501',
  null,
  'Authenticated users cannot insert matches directly'
);

select * from finish();
rollback;
