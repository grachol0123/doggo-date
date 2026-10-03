begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, storage, extensions;

select plan(6);

delete from public.messages
where sender_dog_id in (
  '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
  '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid,
  '1f1f1f1f-1f1f-4f1f-8f1f-1f1f1f1f1f1f'::uuid
);

delete from public.matches
where dog_a_id in (
  '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
  '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid,
  '1f1f1f1f-1f1f-4f1f-8f1f-1f1f1f1f1f1f'::uuid
)
or dog_b_id in (
  '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
  '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid,
  '1f1f1f1f-1f1f-4f1f-8f1f-1f1f1f1f1f1f'::uuid
);

delete from public.swipes
where actor_dog_id in (
  '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
  '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid,
  '1f1f1f1f-1f1f-4f1f-8f1f-1f1f1f1f1f1f'::uuid
)
or target_dog_id in (
  '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
  '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid,
  '1f1f1f1f-1f1f-4f1f-8f1f-1f1f1f1f1f1f'::uuid
);

delete from public.dogs
where id in (
  '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
  '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid,
  '1f1f1f1f-1f1f-4f1f-8f1f-1f1f1f1f1f1f'::uuid
);

delete from auth.users
where id in (
  'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-3333-4ccc-8ccc-cccccccccccc'::uuid
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
    'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'authenticated',
    'authenticated',
    'messages-owner-a@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    'authenticated',
    'authenticated',
    'messages-owner-b@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'cccccccc-3333-4ccc-8ccc-cccccccccccc'::uuid,
    'authenticated',
    'authenticated',
    'messages-owner-c@example.com',
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
    '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
    'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'Message Dog A',
    3
  ),
  (
    '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid,
    'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    'Message Dog B',
    4
  ),
  (
    '1f1f1f1f-1f1f-4f1f-8f1f-1f1f1f1f1f1f'::uuid,
    'cccccccc-3333-4ccc-8ccc-cccccccccccc'::uuid,
    'Message Dog C',
    5
  );

insert into public.swipes (actor_dog_id, target_dog_id, decision)
values
  (
    '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
    '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid,
    'like'::public.swipe_decision
  ),
  (
    '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid,
    '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
    'like'::public.swipe_decision
  );

select results_eq(
  $$
    select count(*)::bigint
    from public.matches
    where dog_a_id = '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid
      and dog_b_id = '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid
  $$,
  array[1::bigint],
  'Mutual likes create a match fixture for message RLS assertions'
);

select id as match_id
from public.matches
where dog_a_id = '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid
  and dog_b_id = '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid \gset

insert into public.messages (match_id, sender_dog_id, body)
select
  id,
  '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
  'Hello from participant A'
from public.matches
where dog_a_id = '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid
  and dog_b_id = '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select results_eq(
  $$
    select count(*)::bigint
    from public.messages
    where body = 'Hello from participant A'
  $$,
  array[1::bigint],
  'Match participant can select messages in their thread'
);

select results_eq(
  $$
    with inserted as (
      insert into public.messages (match_id, sender_dog_id, body)
      select
        id,
        '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid,
        'A follow-up from participant A'
      from public.matches
      where dog_a_id = '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid
        and dog_b_id = '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid
      returning id
    )
    select count(*)::bigint
    from inserted
  $$,
  array[1::bigint],
  'Match participant can insert messages into their thread'
);

select throws_ok(
  $$
    insert into public.messages (match_id, sender_dog_id, body)
    select
      id,
      '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid,
      'Spoofed sender from participant A'
    from public.matches
    where dog_a_id = '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'::uuid
      and dog_b_id = '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'::uuid;
  $$,
  '42501',
  null,
  'Match participant cannot spoof another owner''s sender_dog_id'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    'cccccccc-3333-4ccc-8ccc-cccccccccccc',
    'role',
    'authenticated'
  )::text,
  true
);
set local role authenticated;

select is_empty(
  $$
    select body
    from public.messages
    where body in ('Hello from participant A', 'A follow-up from participant A')
  $$,
  'Non-participant cannot select another pair''s messages'
);

select throws_ok(
  format(
    $fmt$
      insert into public.messages (match_id, sender_dog_id, body)
      values (%L, '1f1f1f1f-1f1f-4f1f-8f1f-1f1f1f1f1f1f'::uuid, 'Intrusion attempt from outsider')
    $fmt$,
    :'match_id'
  ),
  '42501',
  null,
  'Non-participant cannot insert into another pair''s thread'
);

select * from finish();
rollback;
