-- ─────────────────────────────────────────────────────────────────────────────
-- Extend pipeline_runs for the pipeline executor.
--
-- project_id becomes nullable (Evaluate/ad-hoc runs without a saved project).
-- New columns persist the submitted graph and the per-node results so the UI
-- can re-render a historical run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.pipeline_runs
  alter column project_id drop not null;

alter table public.pipeline_runs
  add column if not exists graph_snapshot jsonb,
  add column if not exists started_at     timestamptz default now(),
  add column if not exists completed_at   timestamptz,
  add column if not exists node_results   jsonb,
  add column if not exists summary        jsonb,
  add column if not exists run_to_node    text;

-- Index for "my recent runs"
create index if not exists runs_user_started_idx
  on public.pipeline_runs(user_id, started_at desc);

-- RLS: own rows only (re-statement is safe, CREATE POLICY IF NOT EXISTS 4 syntax).
do $$ begin
  if not exists (select 1 from pg_policies
                 where tablename = 'pipeline_runs' and policyname = 'own_runs') then
    create policy "own_runs" on public.pipeline_runs
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
