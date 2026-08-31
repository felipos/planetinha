import type { GridPoint } from '../grid-point'

/**
 * Enumerates the Grid: the regular lattice of Grid Points covering the whole Earth at a given
 * Resolution. The seed command materialises exactly this into the database, and nothing
 * recomputes it afterwards — the table is the source of truth.
 */
export class GridEnumerator {
  /**
   * Every longitude at a pole names the same physical location, so a pole is enumerated once
   * instead of once per longitude column. This is a Budget optimisation — it saves one upstream
   * call per duplicate — and the api expands the poles back across every longitude on the wire,
   * so it is never visible to a caller.
   */
  static readonly POLE_LONGITUDE = 0

  static enumerate(resolutionDegrees: number): readonly GridPoint[] {
    if (!Number.isFinite(resolutionDegrees) || resolutionDegrees <= 0) {
      throw new Error(`Resolution must be a positive number of degrees, got ${resolutionDegrees}.`)
    }

    const latitudeRows = Math.round(180 / resolutionDegrees) + 1
    const longitudeColumns = Math.round(360 / resolutionDegrees)
    const points: GridPoint[] = []

    for (let row = 0; row < latitudeRows; row += 1) {
      const latitude = GridEnumerator.roundCoordinate(-90 + row * resolutionDegrees)
      if (latitude === -90 || latitude === 90) {
        points.push({ latitude, longitude: GridEnumerator.POLE_LONGITUDE, resolutionDegrees })
        continue
      }
      for (let column = 0; column < longitudeColumns; column += 1) {
        const longitude = GridEnumerator.roundCoordinate(-180 + column * resolutionDegrees)
        points.push({ latitude, longitude, resolutionDegrees })
      }
    }

    return points
  }

  /** How many Grid Points the wire format describes, with each pole expanded back out. */
  static expandedPointCount(resolutionDegrees: number): number {
    const latitudeRows = Math.round(180 / resolutionDegrees) + 1
    const longitudeColumns = Math.round(360 / resolutionDegrees)
    return latitudeRows * longitudeColumns
  }

  /** Keeps a coordinate free of the floating-point dust repeated addition would accumulate. */
  static roundCoordinate(value: number): number {
    return Math.round(value * 10_000) / 10_000
  }
}
