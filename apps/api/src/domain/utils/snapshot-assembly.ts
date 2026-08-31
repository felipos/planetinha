import type { Coverage, SnapshotForecast } from '../snapshot'
import { GridEnumerator } from './grid-enumeration'

/** One Grid Point's stored state for an hour: the position, and its Forecast if it has one. */
export interface StoredSnapshotForecast {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  readonly fetchedAt: Date | null
}

/**
 * Turns what is stored into the uniform lattice the wire describes. Two things happen here, and
 * both exist so that a caller never has to know how the Grid is stored:
 *
 * - Each pole is stored once but named by all 72 longitudes, so it is expanded back across
 *   every longitude column. Pole dedup is a Budget optimisation and must not be visible.
 * - Every Grid Point of the expanded Grid appears, with `null` where there is No Data. The
 *   endpoint never omits a Grid Point, and `null` is never zero.
 */
export class SnapshotAssembler {
  static expand(
    stored: readonly StoredSnapshotForecast[],
    resolutionDegrees: number,
  ): readonly SnapshotForecast[] {
    const longitudeColumns = Math.round(360 / resolutionDegrees)
    const expanded: SnapshotForecast[] = []

    for (const point of stored) {
      if (point.latitude !== 90 && point.latitude !== -90) {
        expanded.push(point)
        continue
      }
      for (let column = 0; column < longitudeColumns; column += 1) {
        expanded.push({
          ...point,
          longitude: GridEnumerator.roundCoordinate(-180 + column * resolutionDegrees),
        })
      }
    }

    return expanded
  }

  /**
   * Coverage counts the expanded lattice, so it is directly comparable with the number of
   * Forecasts a caller receives.
   */
  static coverageOf(forecasts: readonly SnapshotForecast[], resolutionDegrees: number): Coverage {
    return {
      total: GridEnumerator.expandedPointCount(resolutionDegrees),
      withData: forecasts.filter((forecast) => forecast.temperatureCelsius !== null).length,
    }
  }
}
