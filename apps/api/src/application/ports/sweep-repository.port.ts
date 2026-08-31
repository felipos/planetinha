import type { StoredGridPoint } from '../../domain/grid-point'
import type { Sweep } from '../../domain/sweep'

/** A Forecast as it is written: keyed by (Grid Point, Valid At), carrying its own Fetched At. */
export interface ForecastToStore {
  readonly gridPointId: number
  readonly validAt: Date
  readonly temperatureCelsius: number | null
  readonly fetchedAt: Date
}

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

/** Port (dependency-inversion seam) for the write path. */
export interface SweepRepositoryPort {
  /** The Sweep still in progress, if there is one. At most one Sweep is ever open. */
  findOpenSweep(): Promise<Sweep | null>

  /** When the most recent Sweep started, whatever became of it — `null` if none ever has. */
  findLastSweepStartedAt(): Promise<Date | null>

  countGridPoints(resolutionDegrees: number): Promise<number>

  /**
   * The next Slice: up to `sliceSize` Grid Points ordered after the cursor. The ordering is
   * what makes a Sweep resumable, so it must be stable across calls and across restarts.
   */
  findSliceAfter(
    cursorGridPointId: number | null,
    sliceSize: number,
    resolutionDegrees: number,
  ): Promise<readonly StoredGridPoint[]>

  startSweep(startedAt: Date, totalGridPointCount: number): Promise<Sweep>

  /**
   * Writes a Slice's Forecasts and advances the Sweep in one commit. The Forecast write is an
   * idempotent upsert on (Grid Point, Valid At), so a replayed Slice produces no duplicate and
   * a fresher Forecast overwrites an overlapping hour.
   */
  commitSlice(commit: SliceCommit): Promise<void>

  completeSweep(sweepId: number, completedAt: Date): Promise<void>
}
