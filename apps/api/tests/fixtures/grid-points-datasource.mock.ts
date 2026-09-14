import type { GridPointsDbDataSource } from '../../src/datasource/db/grid-points.db.datasource'
import type { StoredGridPoint } from '../../src/domain/models/grid-point'

/** A `GridPointsDbDataSource` held in memory over a fixed list of Grid Points. */
export function createFakeGridPointsDataSource(
  gridPoints: readonly StoredGridPoint[],
): GridPointsDbDataSource {
  return {
    async countGridPoints(): Promise<number> {
      return gridPoints.length
    },

    async findSliceAfter(
      cursorGridPointId: number | null,
      sliceSize: number,
    ): Promise<readonly StoredGridPoint[]> {
      return gridPoints
        .filter((point) => cursorGridPointId === null || point.id > cursorGridPointId)
        .sort((a, b) => a.id - b.id)
        .slice(0, sliceSize)
    },
  } as unknown as GridPointsDbDataSource
}

/** `count` Grid Points with consecutive ids, standing in for a seeded Grid. */
export function storedGridPoints(count: number): StoredGridPoint[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index + 1,
    latitude: -90 + index,
    longitude: -180 + index,
  }))
}
