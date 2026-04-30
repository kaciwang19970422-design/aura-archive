-- Aura Archive image upload storage setup
-- Run this once in Supabase SQL Editor.

insert into storage.buckets (id, name, public)
values ('aura-assets', 'aura-assets', true)
on conflict (id) do update set public = true;

create policy "Aura assets are publicly readable" on storage.objects
  for select using (bucket_id = 'aura-assets');

create policy "Users can upload their own aura assets" on storage.objects
  for insert with check (
    bucket_id = 'aura-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own aura assets" on storage.objects
  for update using (
    bucket_id = 'aura-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own aura assets" on storage.objects
  for delete using (
    bucket_id = 'aura-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
