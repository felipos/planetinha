/**
 * One complete pass over every Grid Point, collecting temperatures from the upstream API. A
 * Sweep has a start, a cursor, and an end, and survives a process restart: the cursor advances
 * only after a Slice commits, so a crash mid-Slice replays that Slice rather than losing it.
 *
 * One row per Sweep rather than one mutable row, so the history of call counts and Rate Limit
 * hits survives.
 */
export type SweepStatus = 'in_progress' | 'completed' | 'failed' | 'abandoned'

export interface Sweep {
  readonly id: number
  readonly startedAt: Date
  readonly completedAt: Date | null
  readonly status: SweepStatus
  /**
   * The id of the last Grid Point committed. `null` on a Sweep that has not committed a Slice
   * yet; the next Slice always starts at the first Grid Point after it.
   */
  readonly cursorGridPointId: number | null
  readonly totalGridPointCount: number
  readonly fetchedGridPointCount: number
  readonly failedGridPointCount: number
  /**
   * Upstream calls made and Rate Limit responses received. The provider does not document how
   * it weights a multi-location call, so these exist to check that assumption against reality
   * rather than trust it.
   */
  readonly upstreamCallsMade: number
  readonly rateLimitHits: number
  readonly lastError: string | null
  readonly lastSliceAt: Date | null
}
