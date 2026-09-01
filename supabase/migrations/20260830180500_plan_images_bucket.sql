-- Storage bucket for plan promo photos (mirrors plan-videos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plan-images', 'plan-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "auth upload plan-images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plan-images');
