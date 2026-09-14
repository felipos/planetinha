import { and, eq, lte, max } from 'drizzle-orm'
import { injectable } from 'tsyringe'
import type { StoredSnapshotForecast } from '../../domain/utils/snapshot-assembly'
import { Database } from './database.service'
import { forecasts, gridPoints } from './entities/schema'

/**
 * Direct Postgres access for the `forecasts` table (joined with `grid_points` for position,
 * since a Forecast belongs to a Grid Point).
 */
@injectable()
export class ForecastsDbDataSource {
  constructor(private readonly database: Database) {}

  async findValidAtToServe(notAfter: Date): Promise<Date | null> {
    const [row] = await this.database.drizzle
      .select({ validAt: max(forecasts.validAt) })
      .from(forecasts)
      .where(lte(forecasts.validAt, notAfter))

    return row?.validAt ?? null
  }

  async findStoredForecasts(validAt: Date): Promise<readonly StoredSnapshotForecast[]> {
    // A left join, not an inner one: a Grid Point with no Forecast for this hour must still come
    // back, with a null temperature, so the endpoint never omits a Grid Point.
    return this.database.drizzle
      .select({
        latitude: gridPoints.latitude,
        longitude: gridPoints.longitude,
        temperatureCelsius: forecasts.temperatureCelsius,
        fetchedAt: forecasts.fetchedAt,
      })
      .from(gridPoints)
      .leftJoin(forecasts, and(eq(forecasts.gridPointId, gridPoints.id), eq(forecasts.validAt, validAt)))
      .orderBy(gridPoints.latitude, gridPoints.longitude)
  }
}
