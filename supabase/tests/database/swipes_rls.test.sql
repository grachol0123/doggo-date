begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, storage, extensions;

select plan(4);

delete from public.swipes
where actor_dog_id in (
  '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'::uuid,
  '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b'::uuid
)
or target_dog_id in (
  '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'::uuid,
  '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b'::uuid
);

delete from public.dogs
where id in (
  '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'::uuid,
  '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b'::uuid
);

delete from auth.users
where id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
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
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'authenticated',
    'authenticated',
    'swipe-owner-a@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    'authenticated',
    'authenticated',
    'swipe-owner-b@example.com',
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
    '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'::uuid,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'Swipe Dog A',
    3
  ),
  (
    '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    'Swipe Dog B',
    4
  );

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into public.swipes (id, actor_dog_id, target_dog_id, decision)
    values (
      '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c'::uuid,
      '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'::uuid,
      '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b'::uuid,
      'pass'::public.swipe_decision
    );
  $$,
  'Owner can insert a swipe for their own dog'
);

select results_eq(
  $$
    select id
    from public.swipes
    where id = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c'::uuid
  $$,
  array['0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c'::uuid],
  'Owner can select a swipe where their dog is the actor'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select results_eq(
  $$
    select id
    from public.swipes
    where id = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c'::uuid
  $$,
  array[]::uuid[],
  'Non-owner cannot select another owner''s swipe'
);

select throws_ok(
  $$
    insert into public.swipes (actor_dog_id, target_dog_id, decision)
    values (
      '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'::uuid,
      '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b'::uuid,
      'like'::public.swipe_decision
    );
  $$,
  '42501',
  null,
  'Authenticated user cannot insert a swipe for another owner''s dog'
);

select * from finish();
rollback;
