begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, storage, extensions;

select plan(4);

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

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    '66666666-6666-4666-8666-666666666666',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select results_eq(
  $$
    with attempted as (
      update storage.objects
      set name = '66666666-6666-4666-8666-666666666666/hijacked.jpg'
      where bucket_id = 'dog-photos'
        and name = '55555555-5555-4555-8555-555555555555/phase3-storage-rls-test.jpg'
      returning 1
    )
    select count(*)::bigint
    from attempted
  $$,
  array[0::bigint],
  'Owner cannot update another user''s dog-photos object'
);

-- storage.objects has a built-in protect_delete() trigger blocking ANY direct
-- SQL DELETE (regardless of RLS ownership match), forcing use of the Storage
-- API instead. This is a hard error, not the RLS-filtered silent 0-row result
-- used for update above — assert throws_ok, not results_eq.
select throws_ok(
  $$
    delete from storage.objects
    where bucket_id = 'dog-photos'
      and name = '55555555-5555-4555-8555-555555555555/phase3-storage-rls-test.jpg'
  $$,
  null,
  'Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'Owner cannot delete another user''s dog-photos object (direct SQL delete is blocked entirely)'
);

select * from finish();
rollback;
