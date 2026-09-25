begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, storage, extensions;

select plan(8);

delete from public.dogs
where owner_id in (
  '33333333-3333-4333-8333-333333333333'::uuid,
  '44444444-4444-4444-8444-444444444444'::uuid
);

delete from auth.users
where id in (
  '33333333-3333-4333-8333-333333333333'::uuid,
  '44444444-4444-4444-8444-444444444444'::uuid
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
    '33333333-3333-4333-8333-333333333333'::uuid,
    'authenticated',
    'authenticated',
    'dog-owner-a@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444444'::uuid,
    'authenticated',
    'authenticated',
    'dog-owner-b@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    '33333333-3333-4333-8333-333333333333',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into public.dogs (
      owner_id,
      name,
      age_years,
      description,
      breed,
      activity_level,
      interests
    )
    values (
      '33333333-3333-4333-8333-333333333333'::uuid,
      'Rex',
      3,
      'Loves long walks and fetch.',
      'Mixed',
      'walker'::public.dog_activity_level,
      array['walks', 'fetch']::public.dog_interest[]
    );
  $$,
  'Owner can insert their own dog profile'
);

select throws_ok(
  $$
    insert into public.dogs (owner_id, name, age_years)
    values ('44444444-4444-4444-8444-444444444444'::uuid, 'Intruder', 2);
  $$,
  '42501',
  null,
  'Authenticated user cannot insert a dog for another owner'
);

select throws_ok(
  $$
    insert into public.dogs (owner_id, name, age_years)
    values ('33333333-3333-4333-8333-333333333333'::uuid, 'Duplicate', 4);
  $$,
  '23505',
  null,
  'Owner cannot create a second dog profile'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    '44444444-4444-4444-8444-444444444444',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.dogs (owner_id, name, age_years)
    values ('44444444-4444-4444-8444-444444444444'::uuid, 'TooYoung', -1);
  $$,
  '23514',
  null,
  'age_years check rejects negative values'
);

select throws_ok(
  $$
    insert into public.dogs (owner_id, name, age_years)
    values (
      '44444444-4444-4444-8444-444444444444'::uuid,
      repeat('n', 101),
      2
    );
  $$,
  '23514',
  null,
  'name check rejects overlong values'
);

select throws_ok(
  $$
    insert into public.dogs (owner_id, name, age_years, breed)
    values (
      '44444444-4444-4444-8444-444444444444'::uuid,
      'Buddy',
      2,
      repeat('b', 101)
    );
  $$,
  '23514',
  null,
  'breed check rejects overlong values'
);

select throws_ok(
  $$
    insert into public.dogs (owner_id, name, age_years, description)
    values (
      '44444444-4444-4444-8444-444444444444'::uuid,
      'Buddy',
      2,
      repeat('d', 501)
    );
  $$,
  '23514',
  null,
  'description check rejects overlong values'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.dogs
    where owner_id = '33333333-3333-4333-8333-333333333333'::uuid
      and name = 'Rex'
  $$,
  array[1::bigint],
  'Authenticated users can select another owner''s dog profile'
);

select * from finish();
rollback;
