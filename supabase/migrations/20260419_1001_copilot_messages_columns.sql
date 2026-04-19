-- ─────────────────────────────────────────────────────────────────────────────
-- Extend copilot_messages for the agent. Idempotent: rerun-safe.
--
-- The agent writes one row per turn with role ∈ {user, assistant, system} and
-- a thread grouped by session_id.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.copilot_messages
  add column if not exists session_id  text,
  add column if not exists attachments jsonb,
  add column if not exists created_at  timestamptz default now();

-- Role column needs to accept 'assistant' too (the orchestrator uses that term).
alter table public.copilot_messages
  drop constraint if exists copilot_messages_role_check;

alter table public.copilot_messages
  add constraint copilot_messages_role_check
  check (role in ('user', 'agent', 'assistant', 'system'));

-- Populate created_at from existing ts column where possible.
update public.copilot_messages
set created_at = ts
where created_at is null and ts is not null;

create index if not exists msgs_session_idx
  on public.copilot_messages(session_id, created_at);

create index if not exists msgs_user_created_idx
  on public.copilot_messages(user_id, created_at desc);

-- RLS: ensure the own-rows-only policy exists.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'copilot_messages' and policyname = 'own_msgs'
  ) then
    create policy "own_msgs" on public.copilot_messages
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
