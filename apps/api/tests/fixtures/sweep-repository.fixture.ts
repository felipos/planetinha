import type {
  ForecastToStore,
  SliceCommit,
  SweepRepositoryPort,
} from '../../src/application/ports/sweep-repository.port'
import type { StoredGridPoint } from '../../src/domain/grid-point'
import type { Sweep } from '../../src/domain/sweep'

export interface FakeSweepRepository extends SweepRepositoryPort {
  readonly sweeps: Sweep[]
  /** Written Forecasts keyed by (Grid Point, Valid At), exactly as the table keys them. */
  readonly forecastsByKey: Map<string, ForecastToStore>
  /** Set to make the commit of the next Slice fail, standing in for a process that dies. */
  failNextCommit: boolean
}

/**
 * A `SweepRepositoryPort` held in memory. It keys Forecasts the way the table does, so a
 * replayed Slice overwrites rather than duplicating, and it only moves the cursor as part of a
 * commit — the two properties resumability rests on.
 */
export function createFakeSweepRepository(gridPoints: readonly StoredGridPoint[]): FakeSweepRepository {
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

  const repository: FakeSweepRepository = {
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

    async countGridPoints(resolutionDegrees: number): Promise<number> {
      return gridPoints.filter((point) => point.resolutionDegrees === resolutionDegrees).length
    },

    async findSliceAfter(
      cursorGridPointId: number | null,
      sliceSize: number,
      resolutionDegrees: number,
    ): Promise<readonly StoredGridPoint[]> {
      return gridPoints
        .filter((point) => point.resolutionDegrees === resolutionDegrees)
        .filter((point) => cursorGridPointId === null || point.id > cursorGridPointId)
        .sort((a, b) => a.id - b.id)
        .slice(0, sliceSize)
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
      if (repository.failNextCommit) {
        repository.failNextCommit = false
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
  }

  return repository
}

/** `count` Grid Points with consecutive ids, standing in for a seeded Grid. */
export function storedGridPoints(count: number, resolutionDegrees = 5): StoredGridPoint[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index + 1,
    latitude: -90 + index,
    longitude: -180 + index,
    resolutionDegrees,
  }))
}
