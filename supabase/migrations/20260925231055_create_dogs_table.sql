create type public.dog_activity_level as enum ('homebody', 'walker', 'runner');

create type public.dog_interest as enum (
  'walks',
  'running',
  'fetch',
  'swimming',
  'agility',
  'obedience_training',
  'playing_with_other_dogs',
  'hiking',
  'camping',
  'car_rides'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  age_years integer not null check (age_years >= 0 and age_years <= 40),
  description text check (char_length(description) <= 500),
  photo_path text,
  breed text check (char_length(breed) <= 100),
  temperament text[],
  activity_level public.dog_activity_level,
  interests public.dog_interest[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_dogs_updated_at
before update on public.dogs
for each row
execute function public.set_updated_at();

alter table public.dogs enable row level security;

create policy dogs_select_authenticated
on public.dogs
for select
to authenticated
using (true);

create policy dogs_insert_own
on public.dogs
for insert
to authenticated
with check (auth.uid() = owner_id);

create policy dogs_update_own
on public.dogs
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy dogs_delete_own
on public.dogs
for delete
to authenticated
using (auth.uid() = owner_id);
