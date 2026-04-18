import type { Project } from '@/types'
import { MOCK_AAPL_GRAPH, MOCK_NVDA_GRAPH } from './mockCanvasState'

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'AAPL Momentum',
    sharpe: 1.24,
    blockCount: 5,
    status: 'healthy',
    updatedAt: '2h ago',
    graph: MOCK_AAPL_GRAPH,
  },
  {
    id: 'proj-2',
    name: 'SPY vs QQQ Pairs',
    sharpe: 0.71,
    blockCount: 8,
    status: 'warning',
    updatedAt: '1d ago',
  },
  {
    id: 'proj-3',
    name: 'BTC Vol Filter',
    sharpe: -0.32,
    blockCount: 7,
    status: 'healthy',
    updatedAt: '3d ago',
  },
  {
    id: 'proj-4',
    name: 'NVDA Momentum',
    sharpe: 1.67,
    blockCount: 6,
    status: 'healthy',
    updatedAt: '5h ago',
    graph: MOCK_NVDA_GRAPH,
  },
]
