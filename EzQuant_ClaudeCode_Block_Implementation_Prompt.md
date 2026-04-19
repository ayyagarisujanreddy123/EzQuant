# Task: Implement the 9 MVP blocks for EzQuant

You are implementing the computational core of EzQuant, a visual quant research 
environment (Simulink-for-quants) built for a hackathon. The app's pipeline is 
signal-first: users construct a signal, gate it on Information Coefficient (IC), 
and only then backtest. Your job right now is ONLY the Python functions behind 
each block — no FastAPI routes, no DAG executor, no frontend. Just pure functions 
with a consistent contract so the canvas executor (built separately) can call them.

Do not over-engineer. This is hackathon scope. No classes unless strictly needed. 
No async. No caching layer. Pandas + numpy + scipy + statsmodels + yfinance only. 
Every block must be under ~60 lines of real code.

---

## 1. Directory layout

Place everything under `backend/blocks/`. Create this structure:

```
backend/
└── blocks/
    ├── __init__.py           # exports BLOCK_REGISTRY dict
    ├── contract.py           # the BlockOutput type + helpers
    ├── source.py             # Universe, CSV Upload
    ├── transforms.py         # Log Returns, Forward Return
    ├── features.py           # EMA, Momentum
    ├── signal.py             # Signal (terminator), Signal Diagnostics
    ├── position.py           # Position Sizer
    ├── backtest.py           # Backtest
    └── tests/
        ├── __init__.py
        ├── test_sanity_pipelines.py   # the 3 IC sanity tests (below)
        └── conftest.py                # shared fixtures (cached SPY data)
```

`__init__.py` must export a `BLOCK_REGISTRY` dict mapping block name strings 
(e.g. `"universe"`, `"log_returns"`, `"signal_diagnostics"`) to the function 
objects. The canvas executor will look up blocks by name from this registry.

---

## 2. The uniform block contract

Every block is a function with this exact signature:

```python
def block_name(inputs: dict, params: dict) -> dict:
    """
    inputs: dict mapping input port names to DataFrames.
            Source blocks receive {} here.
    params: dict of user-configured parameters.
    
    Returns: dict with AT LEAST a "df" key (the output DataFrame).
             May also include "metrics" (dict of scalars/arrays for diagnostic 
             blocks) and "metadata" (dict for provenance / warnings).
    """
```

Define a small helper in `contract.py`:

```python
from typing import TypedDict, Optional
import pandas as pd

class BlockOutput(TypedDict, total=False):
    df: pd.DataFrame
    metrics: dict
    metadata: dict
```

Rules every block must follow:

1. **Never mutate inputs.** Always `df = inputs["df"].copy()` before doing work.
2. **Never drop the original columns.** Blocks ADD columns — they don't replace 
   the DataFrame. This is what lets users chain EMA → Momentum → Signal without 
   losing OHLCV along the way.
3. **Raise `ValueError` with a clear message on bad inputs**, e.g. missing column, 
   non-monotonic index, insufficient rows for the requested window. The canvas 
   console will surface these.
4. **Preserve the DateTimeIndex.** Never reset it. Never convert to integer index.
5. **Single-ticker mode only for MVP.** Multi-ticker is a stretch and not in scope.

---

## 3. The 9 MVP blocks — exact specs

For each block below: the function name, the keys it reads from `inputs` and 
`params`, the column(s) it adds, and the quant rationale you should preserve in 
the docstring. Stick to these names exactly — the frontend block palette is 
wired to them.

### 3.1 `universe(inputs, params)` — source.py

- **Registry name:** `"universe"`
- **Reads `inputs`:** nothing (source block, `inputs = {}`)
- **Reads `params`:** `symbol` (str, e.g. "SPY"), `start` (str "YYYY-MM-DD"), 
  `end` (str "YYYY-MM-DD"), `interval` (str, default `"1d"`)
- **Returns:** `{"df": <OHLCV DataFrame>, "metadata": {...}}`
- **Behavior:** Calls `yfinance.download(symbol, start, end, interval, 
  auto_adjust=True, progress=False)`. If the result is empty, raise 
  `ValueError(f"yfinance returned no data for {symbol}")`. Drop any completely 
  empty rows. Ensure the index is a `DatetimeIndex` named `"Date"`.
- **Metadata must include:** `symbol`, `start`, `end`, `row_count`, 
  `nan_count_per_column` (dict), `date_range` (tuple of str). This is what the 
  right-rail Data Quality Panel consumes.

### 3.2 `csv_upload(inputs, params)` — source.py

- **Registry name:** `"csv_upload"`
- **Reads `params`:** `file_path` (str), `date_column` (str), 
  `price_columns` (list of str, optional — if None, keep all non-date columns)
- **Returns:** `{"df": <DataFrame>, "metadata": {...}}`
- **Behavior:** `pd.read_csv`, parse `date_column` as datetime, set as index, 
  sort by index. Raise if the date column is missing. This is the demo-fallback 
  in case yfinance rate-limits.

### 3.3 `log_returns(inputs, params)` — transforms.py

- **Registry name:** `"log_returns"`
- **Reads `inputs`:** `{"df": DataFrame}`
- **Reads `params`:** `column` (str, default `"Close"`)
- **Adds column:** `"log_return"` computed as `np.log(df[column] / df[column].shift(1))`
- **Drops:** nothing. The first row's `log_return` will be NaN — leave it.

### 3.4 `forward_return(inputs, params)` — transforms.py

- **Registry name:** `"forward_return"`
- **Reads `inputs`:** `{"df": DataFrame}`
- **Reads `params`:** `column` (str, default `"Close"`), `horizon` (int, default 1)
- **Adds column:** `f"forward_return_{horizon}"` computed as 
  `np.log(df[column].shift(-horizon) / df[column])`
- **Rationale in docstring:** This is the prediction target. Making it an 
  explicit block is what makes the research question legible on the canvas.

### 3.5 `ema(inputs, params)` — features.py

- **Registry name:** `"ema"`
- **Reads `inputs`:** `{"df": DataFrame}`
- **Reads `params`:** `column` (str), `span` (int, default 20)
- **Adds column:** `f"ema_{span}"` computed as `df[column].ewm(span=span, adjust=False).mean()`

### 3.6 `momentum(inputs, params)` — features.py

- **Registry name:** `"momentum"`
- **Reads `inputs`:** `{"df": DataFrame}`
- **Reads `params`:** `column` (str, default `"Close"`), `lookback` (int, default 20)
- **Adds column:** `f"momentum_{lookback}"` computed as 
  `df[column] - df[column].shift(lookback)` for price momentum,  
  OR `df[column].rolling(lookback).sum()` if the column is already a return series.  
  Detect via param `mode` (str, `"price"` or `"return"`, default `"price"`).

### 3.7 `signal(inputs, params)` — signal.py

- **Registry name:** `"signal"`
- **Reads `inputs`:** `{"df": DataFrame}`
- **Reads `params`:** `column` (str — name of the column to pin as the signal), 
  `name` (str, optional — user-facing label, default = column)
- **Adds column:** `"signal"` (a copy of `df[column]`)
- **Metadata:** `{"signal_source_column": column, "signal_name": name}`
- **Does NOT transform data.** This block exists purely to make "what is my 
  signal?" a deliberate choice so downstream Signal Diagnostics has a clean 
  contract.

### 3.8 `signal_diagnostics(inputs, params)` — signal.py

- **Registry name:** `"signal_diagnostics"`
- **Reads `inputs`:** `{"signal_df": DataFrame with "signal" col, 
  "forward_return_df": DataFrame with a `forward_return_{k}` col}`. These may be 
  the same DataFrame — handle both cases. Align on index (inner join) before 
  computing anything.
- **Reads `params`:** `ic_type` (str, `"spearman"` or `"pearson"`, default 
  `"spearman"`), `horizons` (list of int, default `[1, 2, 5, 10, 20]`), 
  `forward_return_column` (str, default `"forward_return_1"`)
- **Returns:** `{"df": <aligned DataFrame, passthrough>, "metrics": {...}}`
- **`metrics` must include:**
  - `ic` (float): correlation between `signal` and `forward_return_column`
  - `ic_tstat` (float): `ic * sqrt(n - 2) / sqrt(1 - ic**2)`, with NaN handling
  - `n` (int): sample size after dropping NaNs
  - `ic_decay` (dict[int, float]): IC at each horizon in `horizons`. For each 
    horizon k, compute forward return at k ON THE FLY (don't require the caller 
    to pre-compute every horizon) from the price column, if available; otherwise 
    reuse `forward_return_column` shifted appropriately.
  - `ic_stability` (dict[str, float]): IC computed month-by-month, keyed by 
    "YYYY-MM" string.
  - `signal_autocorr` (float): `corr(signal_t, signal_{t-1})`
- **Implementation notes:** Use `scipy.stats.spearmanr` or pandas `.corr()`. 
  Drop NaN pairs before each correlation. If n < 30, set IC to NaN and return a 
  warning in metadata rather than crashing.

This is the keystone block. Get it right; everything else leans on it.

### 3.9 `position_sizer(inputs, params)` — position.py

- **Registry name:** `"position_sizer"`
- **Reads `inputs`:** `{"df": DataFrame with "signal" column}`
- **Reads `params`:** `mode` (str, `"threshold"` for MVP — also accept 
  `"vol_target"` but implement it as a stub that raises `NotImplementedError` 
  with a clear message), `upper_threshold` (float, default 0), 
  `lower_threshold` (float, default 0)
- **Adds column:** `"position"` ∈ {-1, 0, +1} for threshold mode:  
  `+1` if signal > upper, `-1` if signal < lower, `0` otherwise.

### 3.10 `backtest(inputs, params)` — backtest.py

- **Registry name:** `"backtest"`
- **Reads `inputs`:** `{"df": DataFrame with "position" and a return column}`
- **Reads `params`:** `return_column` (str, default `"log_return"`), 
  `cost_bps` (float, default 0) — transaction cost in basis points per unit 
  change in position
- **Behavior:**
  - **Hardcoded lookahead guard:** compute `pnl_t = position_{t-1} * return_t`. 
    The `shift(1)` is non-negotiable — document it in a comment.
  - Transaction cost: `|Δposition_t| * cost_bps / 10000` subtracted from pnl.
  - Equity curve: `(1 + pnl).cumprod()`.
- **Adds columns:** `"pnl"`, `"equity"`, `"position_change"`.
- **Metrics returned:** `sharpe` (annualized with √252), `total_return`, 
  `max_drawdown`, `hit_rate`, `n_trades` (count of nonzero position changes), 
  `avg_holding_period`.

---

## 4. The three sanity-test pipelines

Put these in `backend/blocks/tests/test_sanity_pipelines.py`. These tests are 
the IC framework's smoke tests — they validate that the Signal Diagnostics 
block is behaving mathematically correctly before any real research is done.

Use pytest. Use `yfinance` to pull SPY once per session (cache it in a 
conftest fixture with session scope to avoid hammering yfinance across tests). 
Use `2015-01-01` to `2023-12-31` as the date range so results are deterministic.

### Test 1 — `test_ic_equals_one_when_signal_is_forward_return`

**Pipeline:** Universe(SPY) → LogReturns → ForwardReturn(horizon=1) → 
Signal(column=`"forward_return_1"`) → SignalDiagnostics

**Expected:** IC ≈ 1.0 (allow `abs(ic - 1.0) < 0.01` for numerical noise and 
index alignment). This is the trivial case where the signal literally IS the 
target. If this test fails, the Signal Diagnostics block is broken at the 
most basic level — the correlation math or the alignment is wrong.

### Test 2 — `test_ic_near_zero_for_random_noise_signal`

**Pipeline:** Universe(SPY) → LogReturns → ForwardReturn(horizon=1), then 
inject a column `"noise"` with `np.random.default_rng(seed=42).standard_normal(len(df))`, 
then Signal(column=`"noise"`) → SignalDiagnostics.

**Expected:** `abs(ic) < 0.05` and `abs(ic_tstat) < 2.0`. A random column has 
no predictive content. If this test fails — if random noise produces a large 
IC — there's a lookahead bug or an alignment bug leaking future information.

Use a fixed seed so the test is deterministic.

### Test 3 — `test_ic_detects_lookahead_when_signal_uses_future`

**Pipeline:** Universe(SPY) → LogReturns → ForwardReturn(horizon=1), then 
construct a deliberately-cheating signal: `df["cheat"] = df["log_return"].shift(-1)` 
(tomorrow's return known today — a lookahead bug). Signal(column=`"cheat"`) → 
SignalDiagnostics.

**Expected:** IC ≈ 1.0 (this cheating signal is literally tomorrow's return, 
which is the target). The test asserts `ic > 0.95`. This test documents the 
signature of a lookahead bug: implausibly high IC. It's the reference point 
for the Lookahead Guard block we'll build in Phase 2.

Add a docstring at the top of each test explaining what it's demonstrating 
and what it would mean if it failed. These tests are documentation as much as 
validation — the judges might read them.

---

## 5. What NOT to do

- **Do not** build the DAG executor, the pipeline runner, the FastAPI routes, 
  the React frontend, the database schema, or any IO beyond yfinance/CSV. 
  Those are separate tasks.
- **Do not** implement stretch blocks (ADF Test, Lookahead Guard, OBV, EMS, 
  Ridge/Logistic Combiner, Walk-Forward, Factor Decomposer, etc.).
- **Do not** add `asyncio`, caching layers, logging frameworks, or custom 
  exception hierarchies. Vanilla `ValueError` is fine.
- **Do not** invent new block names. The registry names above are contracts 
  with the frontend.
- **Do not** over-normalize. Each block function is short and self-contained. 
  A tiny amount of duplication across blocks is fine — the canvas executor 
  benefits from every block being readable in isolation.

---

## 6. Deliverable checklist

When you're done, confirm:

- [ ] `backend/blocks/` exists with all 7 module files
- [ ] `BLOCK_REGISTRY` in `__init__.py` has all 10 functions keyed by string name
- [ ] `contract.py` defines `BlockOutput` and any shared helpers
- [ ] All 3 sanity tests pass when you run `pytest backend/blocks/tests/`
- [ ] A `requirements.txt` (or additions to existing one) includes: `yfinance`, 
  `pandas`, `numpy`, `scipy`, `statsmodels`, `pytest`
- [ ] No block exceeds ~60 lines of real logic
- [ ] Every block has a 2–4 line docstring including the one-line rationale

Ship it.
