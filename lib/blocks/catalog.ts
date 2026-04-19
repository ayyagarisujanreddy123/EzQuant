import type { BlockDefinition, BlockCategory } from '@/types'

export const BLOCK_CATALOG: BlockDefinition[] = [
  // ─── Data (source blocks) ─────────────────────────────────────────────────
  {
    type: 'universe',
    category: 'data',
    label: 'Universe',
    description: 'Fetch OHLCV bars for a single ticker via yfinance.',
    inputPorts: [],
    paramsSchema: [
      { key: 'name', label: 'Display Name', type: 'string', default: 'My Source', placeholder: 'My Apple Source' },
      { key: 'symbol', label: 'Ticker', type: 'string', default: 'SPY', placeholder: 'SPY' },
      { key: 'start', label: 'Start Date', type: 'string', default: '2020-01-01' },
      { key: 'end', label: 'End Date', type: 'string', default: '2024-01-01' },
      { key: 'interval', label: 'Interval', type: 'select', default: '1d', options: ['1d', '1wk', '1mo'] },
    ],
  },
  {
    type: 'csv_upload',
    category: 'data',
    label: 'CSV Upload',
    description: 'Load a CSV with a date column. Demo-fallback when yfinance is rate-limited.',
    inputPorts: [],
    paramsSchema: [
      { key: 'file_path', label: 'File Path', type: 'string', default: '', placeholder: '/path/to/data.csv' },
      { key: 'date_column', label: 'Date Column', type: 'string', default: 'Date' },
    ],
  },

  // ─── Clean (transforms) ───────────────────────────────────────────────────
  {
    type: 'log_returns',
    category: 'clean',
    label: 'Log Returns',
    description: 'Add log(p_t / p_{t-1}) column.',
    inputPorts: ['df'],
    paramsSchema: [{ key: 'column', label: 'Column', type: 'string', default: 'Close' }],
  },
  {
    type: 'forward_return',
    category: 'clean',
    label: 'Forward Return',
    description: 'Prediction target — log(p_{t+h} / p_t).',
    inputPorts: ['df'],
    paramsSchema: [
      { key: 'column', label: 'Column', type: 'string', default: 'Close' },
      { key: 'horizon', label: 'Horizon', type: 'number', default: 1 },
    ],
  },

  // ─── Signal (features + signal-as-terminator + IC diagnostics) ────────────
  {
    type: 'ema',
    category: 'signal',
    label: 'EMA',
    description: 'Exponential moving average of a column.',
    inputPorts: ['df'],
    paramsSchema: [
      { key: 'column', label: 'Column', type: 'string', default: 'Close' },
      { key: 'span', label: 'Span', type: 'number', default: 20 },
    ],
  },
  {
    type: 'momentum',
    category: 'signal',
    label: 'Momentum',
    description: 'price mode: p_t - p_{t-lookback}. return mode: rolling sum of returns.',
    inputPorts: ['df'],
    paramsSchema: [
      { key: 'column', label: 'Column', type: 'string', default: 'Close' },
      { key: 'lookback', label: 'Lookback', type: 'number', default: 20 },
      { key: 'mode', label: 'Mode', type: 'select', default: 'price', options: ['price', 'return'] },
    ],
  },
  {
    type: 'signal',
    category: 'signal',
    label: 'Signal',
    description: 'Pin a column as THE signal so downstream blocks can rely on df.signal.',
    inputPorts: ['df'],
    paramsSchema: [
      { key: 'column', label: 'Source Column', type: 'string', default: 'ema_20' },
      { key: 'name', label: 'Signal Name', type: 'string', default: '', placeholder: 'EMA-20' },
    ],
  },
  {
    type: 'signal_diagnostics',
    category: 'signal',
    label: 'Signal Diagnostics',
    description: 'IC + decay + stability + t-stat. Gatekeeps the Backtest block.',
    inputPorts: ['signal_df', 'forward_return_df'],
    paramsSchema: [
      { key: 'ic_type', label: 'IC Type', type: 'select', default: 'spearman', options: ['spearman', 'pearson'] },
      { key: 'forward_return_column', label: 'Forward Return Col', type: 'string', default: 'forward_return_1' },
    ],
  },

  // ─── Model (position sizing) ──────────────────────────────────────────────
  {
    type: 'position_sizer',
    category: 'model',
    label: 'Position Sizer',
    description: 'Threshold a signal into {-1, 0, +1} positions.',
    inputPorts: ['df'],
    paramsSchema: [
      { key: 'mode', label: 'Mode', type: 'select', default: 'threshold', options: ['threshold'] },
      { key: 'upper_threshold', label: 'Upper Threshold', type: 'number', default: 0 },
      { key: 'lower_threshold', label: 'Lower Threshold', type: 'number', default: 0 },
    ],
  },

  // ─── Eval ─────────────────────────────────────────────────────────────────
  {
    type: 'backtest',
    category: 'eval',
    label: 'Backtest',
    description: 'Lookahead-guarded pnl = position_{t-1} * return_t. Sharpe, drawdown, hit rate.',
    inputPorts: ['df'],
    paramsSchema: [
      { key: 'return_column', label: 'Return Column', type: 'string', default: 'log_return' },
      { key: 'cost_bps', label: 'Cost (bps)', type: 'number', default: 1 },
    ],
  },

  // ─── Stretch (rendered ghosted; backend refuses to execute) ───────────────
  {
    type: 'drop_na', category: 'clean', label: 'Drop NA', stretch: true, inputPorts: ['df'],
    paramsSchema: [{ key: 'axis', label: 'Axis', type: 'select', default: 'rows', options: ['rows', 'cols'] }],
  },
  {
    type: 'resample', category: 'clean', label: 'Resample', stretch: true, inputPorts: ['df'],
    paramsSchema: [{ key: 'freq', label: 'Frequency', type: 'select', default: '1D', options: ['1D', '1W', '1M'] }],
  },
  {
    type: 'z_score', category: 'clean', label: 'Z-Score', stretch: true, inputPorts: ['df'],
    paramsSchema: [{ key: 'window', label: 'Window', type: 'number', default: 20 }],
  },
  {
    type: 'ems', category: 'signal', label: 'EMS', stretch: true, inputPorts: ['df'],
    paramsSchema: [{ key: 'span', label: 'Span', type: 'number', default: 20 }],
  },
  {
    type: 'rolling_corr', category: 'signal', label: 'Rolling Corr', stretch: true, inputPorts: ['df'],
    paramsSchema: [
      { key: 'window', label: 'Window', type: 'number', default: 30 },
      { key: 'other_col', label: 'Other Column', type: 'string', default: 'spy' },
    ],
  },
  {
    type: 'linear_reg', category: 'model', label: 'Linear Reg', stretch: true, inputPorts: ['df'],
    paramsSchema: [
      { key: 'target_col', label: 'Target Column', type: 'string', default: 'forward_return_1' },
      { key: 'feature_cols', label: 'Feature Columns', type: 'string', default: 'ema_20,momentum_20' },
    ],
  },
  {
    type: 'equity_curve', category: 'eval', label: 'Equity Curve', stretch: true, inputPorts: ['df'],
    paramsSchema: [{ key: 'benchmark', label: 'Benchmark', type: 'string', default: '', placeholder: 'SPY (optional)' }],
  },
]

export const CATALOG_BY_TYPE: Record<string, BlockDefinition> = Object.fromEntries(
  BLOCK_CATALOG.map((b) => [b.type, b])
)

export const CATEGORY_DOT: Record<BlockCategory, string> = {
  data: 'bg-eq-blue',
  clean: 'bg-eq-amber',
  signal: 'bg-eq-accent',
  model: 'bg-eq-green',
  eval: 'bg-eq-red',
}

export const CATEGORY_SECTIONS: { category: BlockCategory; label: string }[] = [
  { category: 'data', label: 'Data' },
  { category: 'clean', label: 'Clean' },
  { category: 'signal', label: 'Signal' },
  { category: 'model', label: 'Model' },
  { category: 'eval', label: 'Evaluate' },
]

export const EXECUTABLE_BLOCK_TYPES: Set<string> = new Set(
  BLOCK_CATALOG.filter((b) => !b.stretch).map((b) => b.type)
)
