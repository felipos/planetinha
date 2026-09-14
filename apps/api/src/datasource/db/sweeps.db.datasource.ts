import { desc, eq, isNotNull, sql } from 'drizzle-orm'
import { injectable } from 'tsyringe'
import type { SliceCommit } from '../../domain/models/slice-commit'
import type { SweepState } from '../../domain/models/snapshot'
import type { Sweep } from '../../domain/models/sweep'
import { Database } from './database.service'
import { forecasts, sweeps } from './entities/schema'

/** Direct Postgres access for the `sweeps` table (and the `forecasts` it writes as part of a commit). */
@injectable()
export class SweepsDbDataSource {
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

  async findSweepState(): Promise<SweepState> {
    const [latest] = await this.database.drizzle
      .select({ status: sweeps.status })
      .from(sweeps)
      .orderBy(desc(sweeps.startedAt), desc(sweeps.id))
      .limit(1)

    const [lastCompleted] = await this.database.drizzle
      .select({ completedAt: sweeps.completedAt })
      .from(sweeps)
      .where(isNotNull(sweeps.completedAt))
      .orderBy(desc(sweeps.completedAt))
      .limit(1)

    return { status: latest?.status ?? null, completedAt: lastCompleted?.completedAt ?? null }
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
