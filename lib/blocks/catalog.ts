import type { BlockDefinition, BlockCategory } from '@/types'

export const BLOCK_CATALOG: BlockDefinition[] = [
  // Data
  {
    type: 'ticker_source',
    category: 'data',
    label: 'Ticker Source',
    paramsSchema: [
      { key: 'name', label: 'Display Name', type: 'string', default: 'My Source', placeholder: 'My Apple Source' },
      { key: 'ticker', label: 'Ticker', type: 'string', default: 'AAPL', placeholder: 'AAPL' },
      { key: 'start_date', label: 'Start Date', type: 'string', default: '2020-01-01' },
      { key: 'end_date', label: 'End Date', type: 'string', default: '2024-01-01' },
      { key: 'interval', label: 'Interval', type: 'select', default: '1d', options: ['1d', '1wk', '1mo'] },
    ],
  },
  {
    type: 'csv_upload',
    category: 'data',
    label: 'CSV Upload',
    paramsSchema: [
      { key: 'filename', label: 'File', type: 'string', default: '', placeholder: 'data.csv' },
      { key: 'date_col', label: 'Date Column', type: 'string', default: 'Date' },
      { key: 'price_col', label: 'Price Column', type: 'string', default: 'Close' },
    ],
  },
  // Clean
  {
    type: 'drop_na',
    category: 'clean',
    label: 'Drop NA',
    paramsSchema: [
      { key: 'axis', label: 'Axis', type: 'select', default: 'rows', options: ['rows', 'cols'] },
    ],
  },
  {
    type: 'log_returns',
    category: 'clean',
    label: 'Log Returns',
    paramsSchema: [
      { key: 'col', label: 'Column', type: 'string', default: 'Close', placeholder: 'Close' },
    ],
  },
  {
    type: 'resample',
    category: 'clean',
    label: 'Resample',
    paramsSchema: [
      { key: 'freq', label: 'Frequency', type: 'select', default: '1D', options: ['1D', '1W', '1M'] },
    ],
  },
  {
    type: 'z_score',
    category: 'clean',
    label: 'Z-Score',
    paramsSchema: [{ key: 'window', label: 'Window', type: 'number', default: 20 }],
  },
  // Signal
  {
    type: 'ema',
    category: 'signal',
    label: 'EMA',
    paramsSchema: [{ key: 'span', label: 'Span', type: 'number', default: 20 }],
  },
  {
    type: 'ems',
    category: 'signal',
    label: 'EMS',
    paramsSchema: [
      { key: 'span', label: 'Span', type: 'number', default: 20 },
      { key: 'min_periods', label: 'Min Periods', type: 'number', default: 0 },
    ],
  },
  {
    type: 'momentum',
    category: 'signal',
    label: 'Momentum',
    paramsSchema: [{ key: 'window', label: 'Window', type: 'number', default: 20 }],
  },
  {
    type: 'rolling_corr',
    category: 'signal',
    label: 'Rolling Corr',
    paramsSchema: [
      { key: 'window', label: 'Window', type: 'number', default: 30 },
      { key: 'other_col', label: 'Other Column', type: 'string', default: 'spy', placeholder: 'spy' },
    ],
  },
  // Model
  {
    type: 'linear_reg',
    category: 'model',
    label: 'Linear Reg',
    paramsSchema: [
      { key: 'target_col', label: 'Target Column', type: 'string', default: 'returns' },
      { key: 'feature_cols', label: 'Feature Columns', type: 'string', default: 'ema,momentum' },
    ],
  },
  {
    type: 'threshold_signal',
    category: 'model',
    label: 'Threshold Sig',
    paramsSchema: [
      { key: 'threshold', label: 'Threshold', type: 'number', default: 0.0 },
      { key: 'direction', label: 'Direction', type: 'select', default: 'cross', options: ['above', 'below', 'cross'] },
    ],
  },
  // Eval
  {
    type: 'backtest',
    category: 'eval',
    label: 'Backtest',
    paramsSchema: [
      { key: 'cost_bps', label: 'Cost (bps)', type: 'number', default: 1 },
      { key: 'initial_capital', label: 'Initial Capital', type: 'number', default: 100000 },
    ],
  },
  {
    type: 'equity_curve',
    category: 'eval',
    label: 'Equity Curve',
    paramsSchema: [
      { key: 'benchmark', label: 'Benchmark', type: 'string', default: '', placeholder: 'SPY (optional)' },
    ],
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
