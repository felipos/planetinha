import type { GridPoint } from '../models/grid-point'
import { GRID_RESOLUTION_DEGREES } from '../../core/config'

/**
 * Enumerates the Grid: the regular lattice of Grid Points covering the whole Earth at
 * `GRID_RESOLUTION_DEGREES`. The seed command materialises exactly this into the database, and
 * nothing recomputes it afterwards — the table is the source of truth.
 */
export class GridEnumerator {
  /**
   * Every longitude at a pole names the same physical location, so a pole is enumerated once
   * instead of once per longitude column. This is a Budget optimisation — it saves one upstream
   * call per duplicate — and `PoleExpansion` restores the poles back across every longitude on
   * the wire, so it is never visible to a caller.
   */
  static readonly POLE_LONGITUDE = 0

  static enumerate(): readonly GridPoint[] {
    const latitudeRows = Math.round(180 / GRID_RESOLUTION_DEGREES) + 1
    const longitudeColumns = Math.round(360 / GRID_RESOLUTION_DEGREES)
    const points: GridPoint[] = []

    for (let row = 0; row < latitudeRows; row += 1) {
      const latitude = GridEnumerator.roundCoordinate(-90 + row * GRID_RESOLUTION_DEGREES)
      if (latitude === -90 || latitude === 90) {
        points.push({ latitude, longitude: GridEnumerator.POLE_LONGITUDE })
        continue
      }
      for (let column = 0; column < longitudeColumns; column += 1) {
        const longitude = GridEnumerator.roundCoordinate(-180 + column * GRID_RESOLUTION_DEGREES)
        points.push({ latitude, longitude })
      }
    }

    return points
  }

  /** Keeps a coordinate free of the floating-point dust repeated addition would accumulate. */
  static roundCoordinate(value: number): number {
    return Math.round(value * 10_000) / 10_000
  }
}
