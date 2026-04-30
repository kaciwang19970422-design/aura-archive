# Aura Archive 2.0 - Database Schema (Supabase)

Please execute the following SQL in your Supabase SQL Editor to set up the necessary tables and security policies.

## 1. Tables

```sql
-- Categories table
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  parent_id uuid references public.categories(id),
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Aesthetic Items table
create table public.items (
  id uuid default gen_random_uuid() primary key,
  title text,
  url text not null,
  source_url text,
  aspect text check (aspect in ('portrait', 'landscape', 'square')),
  category_id uuid references public.categories(id),
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

## 2. Row Level Security (RLS)

This ensures that each user can only see and manage their own data.

```sql
-- Enable RLS
alter table public.categories enable row level security;
alter table public.items enable row level security;

-- Policies for Categories
create policy "Users can only view their own categories" on public.categories
  for select using (auth.uid() = user_id);
create policy "Users can insert their own categories" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own categories" on public.categories
  for update using (auth.uid() = user_id);
create policy "Users can delete their own categories" on public.categories
  for delete using (auth.uid() = user_id);

-- Policies for Items
create policy "Users can only view their own items" on public.items
  for select using (auth.uid() = user_id);
create policy "Users can insert their own items" on public.items
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own items" on public.items
  for update using (auth.uid() = user_id);
create policy "Users can delete their own items" on public.items
  for delete using (auth.uid() = user_id);
```

## 3. Storage Bucket

Create a public bucket named `aura-assets` for uploaded images. Each file is stored under the user's auth id, for example `USER_ID/image-id.jpg`.

```sql
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
```
