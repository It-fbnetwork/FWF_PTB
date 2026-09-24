-- FWF Photo Booth — Railway Postgres
-- Run once in Railway Postgres → Query / psql.

create extension if not exists "pgcrypto";

create table if not exists booth_state (
  id int primary key default 1 check (id = 1),
  active_session_id uuid null,
  updated_at timestamptz not null default now()
);

insert into booth_state (id, active_session_id)
values (1, null)
on conflict (id) do nothing;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  phone text not null,
  status text not null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  captured_at timestamptz null,
  completed_at timestamptz null,
  selected_photo_id uuid null,
  selected_frame_id text not null default 'frame-1'
);

alter table sessions
  add column if not exists selected_frame_id text not null default 'frame-1';

create index if not exists sessions_created_at_idx on sessions (created_at desc);
create index if not exists sessions_status_idx on sessions (status);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid null references sessions (id) on delete set null,
  original_filename text not null,
  processed_filename text not null,
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists photos_session_id_idx on photos (session_id);
create index if not exists photos_created_at_idx on photos (created_at desc);

create table if not exists frame_preview_events (
  id uuid primary key default gen_random_uuid(),
  frame_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists frame_preview_events_created_at_idx on frame_preview_events (created_at desc);
