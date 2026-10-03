create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_dog_id uuid not null references public.dogs (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_not_blank check (char_length(trim(body)) > 0)
);

alter table public.messages enable row level security;

create policy messages_select_participant
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.matches m
    join public.dogs d on d.owner_id = auth.uid() and d.id in (m.dog_a_id, m.dog_b_id)
    where m.id = messages.match_id
  )
);

create policy messages_insert_participant
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.dogs d
    where d.id = sender_dog_id and d.owner_id = auth.uid()
  )
  and exists (
    select 1
    from public.matches m
    where m.id = match_id and sender_dog_id in (m.dog_a_id, m.dog_b_id)
  )
);

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.messages;
