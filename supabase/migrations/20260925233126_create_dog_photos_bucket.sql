insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dog-photos',
  'dog-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy dog_photos_public_read
on storage.objects
for select
using (bucket_id = 'dog-photos');

create policy dog_photos_owner_write
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'dog-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy dog_photos_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'dog-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy dog_photos_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'dog-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
