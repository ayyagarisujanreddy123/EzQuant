import type { PipelineGraph } from '@/types'

/**
 * Build a minimal-but-complete momentum pipeline for a given ticker:
 *   universe → log_returns → ema → signal → position_sizer → backtest
 *
 * All param keys match `backend/blocks/BLOCK_REGISTRY` — so hitting Run on
 * these templates immediately exercises the full executor end-to-end.
 */
function momentumPipeline(opts: {
  prefix: string
  symbol: string
  start: string
  end: string
  span: number
}): PipelineGraph {
  const { prefix, symbol, start, end, span } = opts
  return {
    nodes: [
      {
        id: `${prefix}1`,
        type: 'universe',
        position: { x: 40, y: 40 },
        data: {
          id: `${prefix}1`,
          name: `${symbol} Source`,
          category: 'data',
          status: 'idle',
          source: 'copilot',
          blockType: 'universe',
          params: { name: `${symbol} Source`, symbol, start, end, interval: '1d' },
        },
      },
      {
        id: `${prefix}2`,
        type: 'log_returns',
        position: { x: 220, y: 40 },
        data: {
          id: `${prefix}2`,
          name: 'Log Returns',
          category: 'clean',
          status: 'idle',
          source: 'copilot',
          blockType: 'log_returns',
          params: { column: 'Close' },
        },
      },
      {
        id: `${prefix}3`,
        type: 'ema',
        position: { x: 400, y: 40 },
        data: {
          id: `${prefix}3`,
          name: `EMA-${span}`,
          category: 'signal',
          status: 'idle',
          source: 'copilot',
          blockType: 'ema',
          params: { column: 'Close', span },
        },
      },
      {
        id: `${prefix}4`,
        type: 'signal',
        position: { x: 580, y: 40 },
        data: {
          id: `${prefix}4`,
          name: 'Signal',
          category: 'signal',
          status: 'idle',
          source: 'copilot',
          blockType: 'signal',
          params: { column: `ema_${span}`, name: `EMA-${span}` },
        },
      },
      {
        id: `${prefix}5`,
        type: 'position_sizer',
        position: { x: 760, y: 40 },
        data: {
          id: `${prefix}5`,
          name: 'Position Sizer',
          category: 'model',
          status: 'idle',
          source: 'copilot',
          blockType: 'position_sizer',
          params: { mode: 'threshold', upper_threshold: 0, lower_threshold: 0 },
        },
      },
      {
        id: `${prefix}6`,
        type: 'backtest',
        position: { x: 940, y: 40 },
        data: {
          id: `${prefix}6`,
          name: 'Backtest',
          category: 'eval',
          status: 'idle',
          source: 'copilot',
          blockType: 'backtest',
          params: { return_column: 'log_return', cost_bps: 1 },
        },
      },
    ],
    edges: [
      { id: `${prefix}e1`, source: `${prefix}1`, target: `${prefix}2`, data: {} },
      { id: `${prefix}e2`, source: `${prefix}2`, target: `${prefix}3`, data: {} },
      { id: `${prefix}e3`, source: `${prefix}3`, target: `${prefix}4`, data: {} },
      { id: `${prefix}e4`, source: `${prefix}4`, target: `${prefix}5`, data: {} },
      { id: `${prefix}e5`, source: `${prefix}5`, target: `${prefix}6`, data: {} },
    ],
  }
}

export const MOCK_NVDA_GRAPH: PipelineGraph = momentumPipeline({
  prefix: 'n',
  symbol: 'NVDA',
  start: '2020-01-01',
  end: '2024-01-01',
  span: 20,
})

export const MOCK_AAPL_GRAPH: PipelineGraph = momentumPipeline({
  prefix: 'a',
  symbol: 'AAPL',
  start: '2020-01-01',
  end: '2024-01-01',
  span: 20,
})

/**
 * Diagnostics-enhanced momentum pipeline (signal-first workflow):
 *   Universe → Log Returns → EMA → Signal → Position Sizer → Backtest
 *                        └→ Forward Return → Signal Diagnostics
 */
export const MOCK_SPY_DIAGNOSTICS_GRAPH: PipelineGraph = (() => {
  const base = momentumPipeline({
    prefix: 's',
    symbol: 'SPY',
    start: '2020-01-01',
    end: '2024-01-01',
    span: 20,
  })
  base.nodes.push(
    {
      id: 's7',
      type: 'forward_return',
      position: { x: 220, y: 180 },
      data: {
        id: 's7',
        name: 'Forward Return',
        category: 'clean',
        status: 'idle',
        source: 'copilot',
        blockType: 'forward_return',
        params: { column: 'Close', horizon: 1 },
      },
    },
    {
      id: 's8',
      type: 'signal_diagnostics',
      position: { x: 580, y: 180 },
      data: {
        id: 's8',
        name: 'Signal Diagnostics',
        category: 'signal',
        status: 'idle',
        source: 'copilot',
        blockType: 'signal_diagnostics',
        params: { ic_type: 'spearman', forward_return_column: 'forward_return_1' },
      },
    }
  )
  base.edges.push(
    { id: 'se6', source: 's2', target: 's7', data: {} },
    { id: 'se7', source: 's7', target: 's8', data: {} }
  )
  return base
})()
