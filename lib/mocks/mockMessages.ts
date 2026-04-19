import type { Message } from '@/types'

export const MOCK_PROJECTS_MESSAGES: Message[] = [
  {
    id: 'pm0',
    role: 'agent',
    content:
      'Hey! I can answer finance questions, suggest pipeline templates, or help debug errors. Try asking about one of your saved projects, or try /template momentum NVDA.',
    timestamp: new Date('2026-04-18T14:20:00'),
  },
  {
    id: 'pm1',
    role: 'user',
    content: "What's a good Sharpe ratio for a momentum signal?",
    timestamp: new Date('2026-04-18T14:21:00'),
  },
  {
    id: 'pm2',
    role: 'agent',
    content:
      'For daily-bar momentum on liquid equities, out-of-sample Sharpe 0.8–1.5 is realistic. Your AAPL project at 1.24 is healthy. Anything above 2.0 on vanilla momentum should raise suspicion of lookahead bias or overfitting.',
    toolCalls: [{ tool: 'search_knowledge', summary: '4 chunks · 0.3s', status: 'done' }],
    citations: [
      { num: 1, source: 'finance_glossary.md' },
      { num: 2, source: 'hrt_benchmarks_blog' },
      { num: 3, source: 'js_signals_ema.md' },
    ],
    timestamp: new Date('2026-04-18T14:21:05'),
  },
]

export const MOCK_CANVAS_MESSAGES: Message[] = [
  {
    id: 'cm1',
    role: 'user',
    content: 'Backtest a momentum strategy on NVDA',
    timestamp: new Date('2026-04-18T14:22:00'),
  },
  {
    id: 'cm2',
    role: 'agent',
    content:
      'I put together a 5-block pipeline — fetch NVDA, compute log returns, apply a 20-day EMA, threshold to positions, and backtest. Span=20 is a common starting point; try 50 for slower signals.',
    toolCalls: [
      { tool: 'search_knowledge', summary: '3 templates · 0.4s', status: 'done' },
      { tool: 'get_live_market_data', summary: 'NVDA · 252 rows', status: 'done' },
      { tool: 'suggest_pipeline_template', summary: '5 blocks · json', status: 'done' },
    ],
    appliedTemplate: true,
    citations: [
      { num: 1, source: 'momentum_template' },
      { num: 2, source: 'js_signals_ema' },
    ],
    timestamp: new Date('2026-04-18T14:22:01'),
  },
  {
    id: 'cm3',
    role: 'user',
    content: 'Why span=20 and not 50?',
    timestamp: new Date('2026-04-18T14:22:30'),
  },
  {
    id: 'cm4',
    role: 'agent',
    content:
      'Span=20 roughly matches a monthly lookback on daily data — the standard medium-term momentum horizon that has worked historically on US equities. Span=50 is slower, better if you want to reduce turnover at the cost of signal speed. You could A/B them with two EMA blocks.',
    toolCalls: [{ tool: 'search_knowledge', summary: '5 chunks · 0.3s', status: 'done' }],
    timestamp: new Date('2026-04-18T14:22:35'),
  },
]

export const MOCK_GALLERY_MESSAGES: Message[] = [
  {
    id: 'gm1',
    role: 'user',
    content: 'Can you build a pipeline based on this PDF?',
    attachmentNote: '📎 research_report.pdf · 12 pages',
    timestamp: new Date('2026-04-18T14:25:00'),
  },
  {
    id: 'gm2',
    role: 'agent',
    content:
      'The paper describes a cross-sectional momentum factor with volatility adjustment. I built a 6-block version: OHLCV → log returns → 12-1 momentum → vol-adjust → threshold → backtest. Click to load it on a fresh canvas.',
    toolCalls: [
      { tool: 'ingest_document', summary: 'pdf · 47 chunks', status: 'done' },
      { tool: 'suggest_pipeline_template', summary: 'derived · 6 blocks', status: 'done' },
    ],
    citations: [
      { num: 1, source: 'research_report.pdf p.4' },
      { num: 2, source: 'research_report.pdf p.8' },
      { num: 3, source: 'xsec_momentum.md' },
    ],
    timestamp: new Date('2026-04-18T14:25:05'),
  },
]
