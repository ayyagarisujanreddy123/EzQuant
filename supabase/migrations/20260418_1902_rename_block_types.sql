-- ─────────────────────────────────────────────────────────────────────────────
-- Rename block types in existing projects.graph jsonb.
--
--   ticker_source    → universe
--   threshold_signal → position_sizer (mode='threshold' added to params)
--
-- Rationale: backend BLOCK_REGISTRY uses the new names. Frontend + backend
-- now share one vocabulary. Legacy rows in public.projects are rewritten
-- so they load cleanly against the reconciled catalog.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: walk nodes[] in-place, rewrite node.type + node.data.blockType.
create or replace function _ezquant_rename_block_types(g jsonb) returns jsonb
language plpgsql as $$
declare
  rewritten_nodes jsonb;
begin
  if g is null or g->'nodes' is null then
    return g;
  end if;

  select jsonb_agg(
    case
      when n->>'type' = 'ticker_source' then
        jsonb_set(
          jsonb_set(n, '{type}', '"universe"'),
          '{data,blockType}', '"universe"'
        )
      when n->>'type' = 'threshold_signal' then
        jsonb_set(
          jsonb_set(
            jsonb_set(n, '{type}', '"position_sizer"'),
            '{data,blockType}', '"position_sizer"'
          ),
          '{data,params,mode}', '"threshold"'
        )
      else n
    end
  )
  into rewritten_nodes
  from jsonb_array_elements(g->'nodes') as n;

  return jsonb_set(g, '{nodes}', coalesce(rewritten_nodes, '[]'::jsonb));
end;
$$;

update public.projects
set graph = _ezquant_rename_block_types(graph)
where graph is not null
  and (
    graph::text like '%"ticker_source"%'
    or graph::text like '%"threshold_signal"%'
  );

drop function _ezquant_rename_block_types(jsonb);
