-- Simple, no-email identity mode.
--
-- The frontend collects only (full_name, date_of_birth). A deterministic UUID
-- is derived from those two fields (uuid-shaped sha256 over "name|dob"). That
-- id becomes the user_id everywhere, so the same (name, DOB) always resolves
-- to the same Supabase rows across devices.
--
-- This replaces the Supabase Auth flow for the "just try it" hackathon mode.
-- All writes go through FastAPI using the service-role key, so we don't need
-- RLS to gate per-user reads — the backend filters on user_id directly.

-- ── simple_users ───────────────────────────────────────────────────────────
create table if not exists public.simple_users (
    id          uuid primary key,
    full_name   text not null,
    dob         date not null,
    created_at  timestamptz not null default now(),
    last_seen   timestamptz not null default now()
);

create index if not exists simple_users_name_dob_idx
    on public.simple_users (full_name, dob);

-- Allow the service-role client (backend) to do anything. No anon access.
alter table public.simple_users enable row level security;
drop policy if exists "service role all" on public.simple_users;
create policy "service role all" on public.simple_users
    for all
    to service_role
    using (true)
    with check (true);

-- ── projects ───────────────────────────────────────────────────────────────
-- Existing `projects.user_id` is already uuid — same shape as the derived id.
-- Drop old Supabase-Auth-based policies; backend filters per user_id itself.
alter table public.projects enable row level security;

drop policy if exists "own_projects" on public.projects;
drop policy if exists "own projects" on public.projects;
drop policy if exists "user can view own projects" on public.projects;
drop policy if exists "user can modify own projects" on public.projects;

-- Service role (backend) does everything; no anon access (frontend calls
-- the backend, not Supabase directly).
drop policy if exists "service role all" on public.projects;
create policy "service role all" on public.projects
    for all
    to service_role
    using (true)
    with check (true);
