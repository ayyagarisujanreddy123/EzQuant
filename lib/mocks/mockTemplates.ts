import type { Template } from '@/types'
import { MOCK_AAPL_GRAPH, MOCK_NVDA_GRAPH } from './mockCanvasState'

export const MOCK_TEMPLATES: Template[] = [
  {
    id: 'tpl-mom',
    name: 'Momentum Signal',
    description: 'EMA crossover on daily log returns with threshold',
    accentColor: 'green',
    icon: '↗',
    sharpe: 1.24,
    blockCount: 5,
    graph: MOCK_AAPL_GRAPH,
  },
  {
    id: 'tpl-pairs',
    name: 'Pairs Trade',
    description: 'Rolling correlation mean-reversion on two tickers',
    accentColor: 'blue',
    icon: '↔',
    sharpe: 0.89,
    blockCount: 6,
    graph: MOCK_NVDA_GRAPH,
  },
  {
    id: 'tpl-vol',
    name: 'Vol Breakout',
    description: 'Z-score vol regime filter with momentum entry',
    accentColor: 'amber',
    icon: '⚡',
    sharpe: 1.07,
    blockCount: 7,
    graph: MOCK_NVDA_GRAPH,
  },
]
