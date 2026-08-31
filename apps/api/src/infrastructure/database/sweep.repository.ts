import { and, asc, count, desc, eq, gt, sql } from 'drizzle-orm'
import { injectable } from 'tsyringe'
import type { SliceCommit, SweepRepositoryPort } from '../../application/ports/sweep-repository.port'
import type { StoredGridPoint } from '../../domain/grid-point'
import type { Sweep } from '../../domain/sweep'
import { Database } from './database.service'
import { forecasts, gridPoints, sweeps } from './schema'

/** Concrete `SweepRepositoryPort` over Postgres. */
@injectable()
export class SweepRepository implements SweepRepositoryPort {
  constructor(private readonly database: Database) {}

  async findOpenSweep(): Promise<Sweep | null> {
    const [sweep] = await this.database.drizzle
      .select()
      .from(sweeps)
      .where(eq(sweeps.status, 'in_progress'))
      .orderBy(desc(sweeps.startedAt), desc(sweeps.id))
      .limit(1)

    return sweep ?? null
  }

  async findLastSweepStartedAt(): Promise<Date | null> {
    const [sweep] = await this.database.drizzle
      .select({ startedAt: sweeps.startedAt })
      .from(sweeps)
      .orderBy(desc(sweeps.startedAt), desc(sweeps.id))
      .limit(1)

    return sweep?.startedAt ?? null
  }

  async countGridPoints(resolutionDegrees: number): Promise<number> {
    const [row] = await this.database.drizzle
      .select({ value: count() })
      .from(gridPoints)
      .where(eq(gridPoints.resolutionDegrees, resolutionDegrees))

    return row?.value ?? 0
  }

  async findSliceAfter(
    cursorGridPointId: number | null,
    sliceSize: number,
    resolutionDegrees: number,
  ): Promise<readonly StoredGridPoint[]> {
    // Ordering by id is the Sweep's ordering: ids are assigned once by the seed and never move,
    // so the same cursor yields the same next Slice across restarts.
    return await this.database.drizzle
      .select({
        id: gridPoints.id,
        latitude: gridPoints.latitude,
        longitude: gridPoints.longitude,
        resolutionDegrees: gridPoints.resolutionDegrees,
      })
      .from(gridPoints)
      .where(
        and(
          eq(gridPoints.resolutionDegrees, resolutionDegrees),
          cursorGridPointId === null ? undefined : gt(gridPoints.id, cursorGridPointId),
        ),
      )
      .orderBy(asc(gridPoints.id))
      .limit(sliceSize)
  }

  async startSweep(startedAt: Date, totalGridPointCount: number): Promise<Sweep> {
    const [sweep] = await this.database.drizzle
      .insert(sweeps)
      .values({ startedAt, status: 'in_progress', totalGridPointCount })
      .returning()

    if (sweep === undefined) {
      throw new Error('The Sweep could not be started: the database returned no row.')
    }
    return sweep
  }

  async commitSlice(commit: SliceCommit): Promise<void> {
    // One transaction, so a process that dies partway through leaves the cursor where it was
    // and the interrupted Slice replays instead of being silently lost.
    await this.database.drizzle.transaction(async (transaction) => {
      if (commit.forecasts.length > 0) {
        await transaction
          .insert(forecasts)
          .values([...commit.forecasts])
          .onConflictDoUpdate({
            target: [forecasts.gridPointId, forecasts.validAt],
            set: {
              temperatureCelsius: sql`excluded.temperature_celsius`,
              fetchedAt: sql`excluded.fetched_at`,
            },
          })
      }

      await transaction
        .update(sweeps)
        .set({
          cursorGridPointId: commit.cursorGridPointId,
          fetchedGridPointCount: sql`${sweeps.fetchedGridPointCount} + ${commit.fetchedGridPointCount}`,
          failedGridPointCount: sql`${sweeps.failedGridPointCount} + ${commit.failedGridPointCount}`,
          upstreamCallsMade: sql`${sweeps.upstreamCallsMade} + ${commit.upstreamCallsMade}`,
          rateLimitHits: sql`${sweeps.rateLimitHits} + ${commit.rateLimitHits}`,
          lastError: commit.lastError,
          lastSliceAt: commit.lastSliceAt,
        })
        .where(eq(sweeps.id, commit.sweepId))
    })
  }

  async completeSweep(sweepId: number, completedAt: Date): Promise<void> {
    await this.database.drizzle
      .update(sweeps)
      .set({ status: 'completed', completedAt })
      .where(eq(sweeps.id, sweepId))
  }
}
