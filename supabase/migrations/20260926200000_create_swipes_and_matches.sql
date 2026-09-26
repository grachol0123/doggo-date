create type public.swipe_decision as enum ('like', 'pass');

create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  actor_dog_id uuid not null references public.dogs (id) on delete cascade,
  target_dog_id uuid not null references public.dogs (id) on delete cascade,
  decision public.swipe_decision not null,
  created_at timestamptz not null default now(),
  constraint swipes_no_self_swipe check (actor_dog_id <> target_dog_id),
  constraint swipes_actor_target_unique unique (actor_dog_id, target_dog_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  dog_a_id uuid not null references public.dogs (id) on delete cascade,
  dog_b_id uuid not null references public.dogs (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint matches_canonical_order check (dog_a_id < dog_b_id),
  constraint matches_pair_unique unique (dog_a_id, dog_b_id)
);

-- Runs as the migration's owning role (bypassing RLS) so it can see both owners'
-- swipe rows regardless of which user's insert fired it, and atomically create
-- the match within the same transaction as the second "like" — no app-level
-- check-then-insert race window.
create or replace function public.create_match_on_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reverse_exists boolean;
begin
  if new.decision <> 'like' then
    return new;
  end if;

  select exists (
    select 1
    from public.swipes
    where actor_dog_id = new.target_dog_id
      and target_dog_id = new.actor_dog_id
      and decision = 'like'
  ) into reverse_exists;

  if reverse_exists then
    insert into public.matches (dog_a_id, dog_b_id)
    values (least(new.actor_dog_id, new.target_dog_id), greatest(new.actor_dog_id, new.target_dog_id))
    on conflict (dog_a_id, dog_b_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger swipes_create_match
after insert on public.swipes
for each row
execute function public.create_match_on_mutual_like();

alter table public.swipes enable row level security;

create policy swipes_select_own
on public.swipes
for select
to authenticated
using (
  exists (
    select 1 from public.dogs d
    where d.id = actor_dog_id and d.owner_id = auth.uid()
  )
);

create policy swipes_insert_own
on public.swipes
for insert
to authenticated
with check (
  exists (
    select 1 from public.dogs d
    where d.id = actor_dog_id and d.owner_id = auth.uid()
  )
);

alter table public.matches enable row level security;

create policy matches_select_participant
on public.matches
for select
to authenticated
using (
  exists (
    select 1 from public.dogs d
    where d.owner_id = auth.uid() and d.id in (dog_a_id, dog_b_id)
  )
);
