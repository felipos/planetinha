import type { Coverage, SnapshotForecast } from '../models/snapshot'
import { PoleExpansion } from './pole-expansion'

/** One Grid Point's stored state for an hour: the position, and its Forecast if it has one. */
export interface StoredSnapshotForecast {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  readonly fetchedAt: Date | null
}

/**
 * Turns what is stored into the uniform lattice the wire describes: every Grid Point of the
 * expanded Grid appears, with `null` where there is No Data. The endpoint never omits a Grid
 * Point, and `null` is never zero. Pole Expansion is what makes the stored (deduplicated) Grid
 * look like the full one to a caller — see `PoleExpansion`.
 */
export class SnapshotAssembler {
  static expand(stored: readonly StoredSnapshotForecast[]): readonly SnapshotForecast[] {
    const expanded: SnapshotForecast[] = []

    for (const point of stored) {
      if (!PoleExpansion.isPole(point.latitude)) {
        expanded.push(point)
        continue
      }
      expanded.push(...PoleExpansion.expand(point))
    }

    return expanded
  }

  /**
   * Coverage counts the expanded lattice, so it is directly comparable with the number of
   * Forecasts a caller receives.
   */
  static coverageOf(forecasts: readonly SnapshotForecast[]): Coverage {
    return {
      total: PoleExpansion.count(),
      withData: forecasts.filter((forecast) => forecast.temperatureCelsius !== null).length,
    }
  }
}
