import { and, asc, count, eq, gt } from 'drizzle-orm'
import { injectable } from 'tsyringe'
import type { StoredGridPoint } from '../../domain/models/grid-point'
import { Database } from './database.service'
import { gridPoints } from './entities/schema'

/** Direct Postgres access for the `grid_points` table. */
@injectable()
export class GridPointsDbDataSource {
  constructor(private readonly database: Database) {}

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
}
