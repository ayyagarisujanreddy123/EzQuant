import type { Template } from '@/types'
import {
  MOCK_AAPL_GRAPH,
  MOCK_NVDA_GRAPH,
  MOCK_SPY_DIAGNOSTICS_GRAPH,
} from './mockCanvasState'

export const MOCK_TEMPLATES: Template[] = [
  {
    id: 'tpl-mom-aapl',
    name: 'AAPL Momentum',
    description: 'EMA-20 on log returns → threshold position → backtest',
    accentColor: 'green',
    icon: '↗',
    sharpe: 0.92,
    blockCount: 6,
    graph: MOCK_AAPL_GRAPH,
  },
  {
    id: 'tpl-mom-nvda',
    name: 'NVDA Momentum',
    description: 'Same pipeline on NVDA — illustrates ticker swapping',
    accentColor: 'blue',
    icon: '↗',
    sharpe: 1.67,
    blockCount: 6,
    graph: MOCK_NVDA_GRAPH,
  },
  {
    id: 'tpl-spy-diagnostics',
    name: 'SPY + IC Diagnostics',
    description: 'Full signal-first: EMA signal + Forward Return + IC diagnostics',
    accentColor: 'amber',
    icon: '✦',
    sharpe: 0.38,
    blockCount: 8,
    graph: MOCK_SPY_DIAGNOSTICS_GRAPH,
  },
]
