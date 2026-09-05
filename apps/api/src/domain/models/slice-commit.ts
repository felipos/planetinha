import type { ForecastToStore } from './forecast-to-store'

/**
 * Everything one Slice changes about the world, applied together. Writing the Forecasts and
 * moving the cursor in a single commit is what makes resumability work: a process that dies
 * partway through leaves the cursor where it was, and the interrupted Slice simply replays.
 *
 * The counts are deltas to add to the Sweep, not new totals.
 */
export interface SliceCommit {
  readonly sweepId: number
  readonly forecasts: readonly ForecastToStore[]
  readonly cursorGridPointId: number
  readonly fetchedGridPointCount: number
  readonly failedGridPointCount: number
  readonly upstreamCallsMade: number
  readonly rateLimitHits: number
  readonly lastError: string | null
  readonly lastSliceAt: Date
}
