import type { OhlcvBar } from '@/types'
import { resolveBackendUrl } from './baseUrl'

export interface OhlcvResponse {
  symbol: string
  interval: string
  period: string | null
  start: string | null
  end: string | null
  bars: OhlcvBar[]
}

export interface FetchOhlcvParams {
  symbol: string
  interval?: string
  start?: string  // YYYY-MM-DD
  end?: string    // YYYY-MM-DD
  period?: string // e.g. '1mo', '1y' — alternative to start/end
}

/**
 * Calls backend GET /api/market/ohlcv.
 * Either (start + end) OR period — backend validates.
 */
export async function fetchOhlcv(params: FetchOhlcvParams): Promise<OhlcvResponse> {
  if (!params.symbol?.trim()) throw new Error('Symbol is required')

  const q = new URLSearchParams({
    symbol: params.symbol.trim().toUpperCase(),
    interval: params.interval ?? '1d',
  })

  if (params.period) {
    q.set('period', params.period)
  } else {
    if (!params.start || !params.end) {
      throw new Error('Both start and end dates are required (or set period)')
    }
    q.set('start', `${params.start}T00:00:00`)
    q.set('end', `${params.end}T00:00:00`)
  }

  const res = await fetch(`${resolveBackendUrl()}/api/market/ohlcv?${q.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }

  return res.json()
}
