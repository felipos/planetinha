import { asc, count, gt } from 'drizzle-orm'
import { injectable } from 'tsyringe'
import type { StoredGridPoint } from '../../domain/models/grid-point'
import { Database } from './database.service'
import { gridPoints } from './entities/schema'

/** Direct Postgres access for the `grid_points` table. */
@injectable()
export class GridPointsDbDataSource {
  constructor(private readonly database: Database) {}

  async countGridPoints(): Promise<number> {
    const [row] = await this.database.drizzle.select({ value: count() }).from(gridPoints)
    return row?.value ?? 0
  }

  async findSliceAfter(
    cursorGridPointId: number | null,
    sliceSize: number,
  ): Promise<readonly StoredGridPoint[]> {
    // Ordering by id is the Sweep's ordering: ids are assigned once by the seed and never move,
    // so the same cursor yields the same next Slice across restarts.
    return this.database.drizzle
      .select({
        id: gridPoints.id,
        latitude: gridPoints.latitude,
        longitude: gridPoints.longitude,
      })
      .from(gridPoints)
      .where(cursorGridPointId === null ? undefined : gt(gridPoints.id, cursorGridPointId))
      .orderBy(asc(gridPoints.id))
      .limit(sliceSize)
  }
}
