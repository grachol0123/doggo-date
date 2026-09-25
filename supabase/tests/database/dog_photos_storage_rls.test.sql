begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, storage, extensions;

select plan(2);

delete from auth.users
where id in (
  '55555555-5555-4555-8555-555555555555'::uuid,
  '66666666-6666-4666-8666-666666666666'::uuid
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
    '55555555-5555-4555-8555-555555555555'::uuid,
    'authenticated',
    'authenticated',
    'dog-storage-a@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '66666666-6666-4666-8666-666666666666'::uuid,
    'authenticated',
    'authenticated',
    'dog-storage-b@example.com',
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
    '55555555-5555-4555-8555-555555555555',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values (
      'dog-photos',
      '55555555-5555-4555-8555-555555555555/phase3-storage-rls-test.jpg',
      '55555555-5555-4555-8555-555555555555'::uuid,
      '55555555-5555-4555-8555-555555555555'
    );
  $$,
  'Owner can insert an object into their own dog-photos prefix'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, owner_id)
    values (
      'dog-photos',
      '66666666-6666-4666-8666-666666666666/phase3-storage-rls-test.jpg',
      '55555555-5555-4555-8555-555555555555'::uuid,
      '55555555-5555-4555-8555-555555555555'
    );
  $$,
  '42501',
  null,
  'Owner cannot insert an object into another user''s prefix'
);

select * from finish();
rollback;
