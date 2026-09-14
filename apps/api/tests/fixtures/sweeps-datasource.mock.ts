import type { ForecastToStore } from '../../src/domain/models/forecast-to-store'
import type { SliceCommit } from '../../src/domain/models/slice-commit'
import type { SweepState } from '../../src/domain/models/snapshot'
import type { Sweep } from '../../src/domain/models/sweep'
import type { SweepsDbDataSource } from '../../src/datasource/db/sweeps.db.datasource'

export interface FakeSweepsDataSource extends SweepsDbDataSource {
  readonly sweeps: Sweep[]
  /** Written Forecasts keyed by (Grid Point, Valid At), exactly as the table keys them. */
  readonly forecastsByKey: Map<string, ForecastToStore>
  /** Set to make the commit of the next Slice fail, standing in for a process that dies. */
  failNextCommit: boolean
}

export interface FakeSweepsDataSourceOptions {
  /** Overrides `findSweepState`'s answer instead of deriving it from the sweep rows. */
  readonly sweep?: SweepState
}

const NO_SWEEP: SweepState = { status: null, completedAt: null }

/**
 * A `SweepsDbDataSource` held in memory. It keys Forecasts the way the table does, so a
 * replayed Slice overwrites rather than duplicating, and it only moves the cursor as part of a
 * commit — the two properties resumability rests on.
 */
export function createFakeSweepsDataSource(options: FakeSweepsDataSourceOptions = {}): FakeSweepsDataSource {
  const sweepRows: Sweep[] = []
  const forecastsByKey = new Map<string, ForecastToStore>()
  let nextSweepId = 1

  function replace(sweepId: number, changes: Partial<Sweep>): void {
    const index = sweepRows.findIndex((sweep) => sweep.id === sweepId)
    const existing = sweepRows[index]
    if (existing === undefined) {
      throw new Error(`No Sweep with id ${sweepId}.`)
    }
    sweepRows[index] = { ...existing, ...changes }
  }

  const dataSource: FakeSweepsDataSource = {
    sweeps: sweepRows,
    forecastsByKey,
    failNextCommit: false,

    async findOpenSweep(): Promise<Sweep | null> {
      return sweepRows.find((sweep) => sweep.status === 'in_progress') ?? null
    },

    async findLastSweepStartedAt(): Promise<Date | null> {
      const sorted = [...sweepRows].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      return sorted[0]?.startedAt ?? null
    },

    async findSweepState(): Promise<SweepState> {
      if (options.sweep !== undefined) {
        return options.sweep
      }
      if (sweepRows.length === 0) {
        return NO_SWEEP
      }
      const latest = [...sweepRows].sort(
        (a, b) => b.startedAt.getTime() - a.startedAt.getTime() || b.id - a.id,
      )[0]
      const lastCompleted = sweepRows
        .filter((sweep): sweep is Sweep & { completedAt: Date } => sweep.completedAt !== null)
        .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())[0]
      return { status: latest?.status ?? null, completedAt: lastCompleted?.completedAt ?? null }
    },

    async startSweep(startedAt: Date, totalGridPointCount: number): Promise<Sweep> {
      const sweep: Sweep = {
        id: nextSweepId,
        startedAt,
        completedAt: null,
        status: 'in_progress',
        cursorGridPointId: null,
        totalGridPointCount,
        fetchedGridPointCount: 0,
        failedGridPointCount: 0,
        upstreamCallsMade: 0,
        rateLimitHits: 0,
        lastError: null,
        lastSliceAt: null,
      }
      nextSweepId += 1
      sweepRows.push(sweep)
      return sweep
    },

    async commitSlice(commit: SliceCommit): Promise<void> {
      if (dataSource.failNextCommit) {
        dataSource.failNextCommit = false
        // Nothing is written and the cursor does not move: the Slice was never committed.
        throw new Error('The database went away mid-commit.')
      }

      for (const forecast of commit.forecasts) {
        forecastsByKey.set(`${forecast.gridPointId}|${forecast.validAt.toISOString()}`, forecast)
      }

      const sweep = sweepRows.find((row) => row.id === commit.sweepId)
      if (sweep === undefined) {
        throw new Error(`No Sweep with id ${commit.sweepId}.`)
      }
      replace(commit.sweepId, {
        cursorGridPointId: commit.cursorGridPointId,
        fetchedGridPointCount: sweep.fetchedGridPointCount + commit.fetchedGridPointCount,
        failedGridPointCount: sweep.failedGridPointCount + commit.failedGridPointCount,
        upstreamCallsMade: sweep.upstreamCallsMade + commit.upstreamCallsMade,
        rateLimitHits: sweep.rateLimitHits + commit.rateLimitHits,
        lastError: commit.lastError,
        lastSliceAt: commit.lastSliceAt,
      })
    },

    async completeSweep(sweepId: number, completedAt: Date): Promise<void> {
      replace(sweepId, { status: 'completed', completedAt })
    },
  } as unknown as FakeSweepsDataSource

  return dataSource
}
