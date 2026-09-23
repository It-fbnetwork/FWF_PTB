-- FWF Photo Booth Phase 4 schema
-- Paste into Supabase → SQL → New query → Run.

create extension if not exists "pgcrypto";

create table if not exists public.booth_state (
  id int primary key default 1 check (id = 1),
  active_session_id uuid null,
  updated_at timestamptz not null default now()
);

insert into public.booth_state (id, active_session_id)
values (1, null)
on conflict (id) do nothing;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  phone text not null,
  status text not null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  captured_at timestamptz null,
  completed_at timestamptz null,
  selected_photo_id uuid null
);

create index if not exists sessions_created_at_idx on public.sessions (created_at desc);
create index if not exists sessions_status_idx on public.sessions (status);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid null references public.sessions (id) on delete set null,
  original_filename text not null,
  processed_filename text not null,
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists photos_session_id_idx on public.photos (session_id);
create index if not exists photos_created_at_idx on public.photos (created_at desc);

-- Storage bucket (public read for guest download / LED)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;
