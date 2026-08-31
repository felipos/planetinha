import { and, desc, eq, isNotNull, lte, max } from 'drizzle-orm'
import { injectable } from 'tsyringe'
import type { SnapshotRepositoryPort } from '../../application/ports/snapshot-repository.port'
import type { SweepState } from '../../domain/snapshot'
import type { StoredSnapshotForecast } from '../../domain/utils/snapshot-assembly'
import { Database } from './database.service'
import { forecasts, gridPoints, sweeps } from './schema'

/** Concrete `SnapshotRepositoryPort` over Postgres. */
@injectable()
export class SnapshotRepository implements SnapshotRepositoryPort {
  constructor(private readonly database: Database) {}

  async findValidAtToServe(notAfter: Date, resolutionDegrees: number): Promise<Date | null> {
    const [row] = await this.database.drizzle
      .select({ validAt: max(forecasts.validAt) })
      .from(forecasts)
      .innerJoin(gridPoints, eq(forecasts.gridPointId, gridPoints.id))
      .where(and(lte(forecasts.validAt, notAfter), eq(gridPoints.resolutionDegrees, resolutionDegrees)))

    return row?.validAt ?? null
  }

  async findStoredForecasts(
    validAt: Date,
    resolutionDegrees: number,
  ): Promise<readonly StoredSnapshotForecast[]> {
    // A left join, not an inner one: a Grid Point with no Forecast for this hour must still come
    // back, with a null temperature, so the endpoint never omits a Grid Point.
    return await this.database.drizzle
      .select({
        latitude: gridPoints.latitude,
        longitude: gridPoints.longitude,
        temperatureCelsius: forecasts.temperatureCelsius,
        fetchedAt: forecasts.fetchedAt,
      })
      .from(gridPoints)
      .leftJoin(forecasts, and(eq(forecasts.gridPointId, gridPoints.id), eq(forecasts.validAt, validAt)))
      .where(eq(gridPoints.resolutionDegrees, resolutionDegrees))
      .orderBy(gridPoints.latitude, gridPoints.longitude)
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
}
