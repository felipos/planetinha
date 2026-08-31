import type { Forecast } from '../forecast'
import type { Snapshot } from '../snapshot'

export interface CellLookup {
  readonly forecastsByCell: ReadonlyMap<string, Forecast>
  readonly resolutionDegrees: number
}

/** The Grid Point a Cell belongs to. */
export interface CellPosition {
  readonly latitude: number
  readonly longitude: number
}

const COORD_PRECISION = 4

/**
 * Finds the Cell containing an arbitrary lat/long, and the Forecast that colours it. Nothing
 * here blends anything: a Cell shows its own Grid Point's Forecast, or nothing at all.
 *
 * A Cell is centred on its Grid Point rather than starting at it, which is what makes the poles
 * render like everywhere else — the row at 90° covers the cap above 87.5° instead of a strip of
 * zero height, so there is no permanent hole at the top or bottom of the globe.
 *
 * Used both to generate the heatmap texture and to look up a clicked point, so both agree on
 * which lat/long belongs to which Cell.
 */
export class CellLocator {
  static roundCoordinate(value: number): number {
    const factor = 10 ** COORD_PRECISION
    return Math.round(value * factor) / factor
  }

  static wrapLongitude(longitude: number): number {
    let wrapped = longitude
    while (wrapped < -180) {
      wrapped += 360
    }
    while (wrapped >= 180) {
      wrapped -= 360
    }
    return wrapped
  }

  static buildLookup(snapshot: Snapshot): CellLookup {
    const forecastsByCell = new Map<string, Forecast>()
    for (const forecast of snapshot.forecasts) {
      forecastsByCell.set(CellLocator.cellKey(forecast.latitude, forecast.longitude), forecast)
    }
    return { forecastsByCell, resolutionDegrees: snapshot.resolutionDegrees }
  }

  /** The Grid Point whose Cell contains this position, or `null` if the Grid has no spacing. */
  static cellFor(lookup: CellLookup, latitude: number, longitude: number): CellPosition | null {
    const step = lookup.resolutionDegrees
    if (step <= 0) {
      return null
    }

    const clampedLatitude = Math.min(Math.max(latitude, -90), 90)
    const wrappedLongitude = CellLocator.wrapLongitude(longitude)

    return {
      latitude: CellLocator.roundCoordinate(Math.round(clampedLatitude / step) * step),
      longitude: CellLocator.wrapLongitude(
        CellLocator.roundCoordinate(Math.round(wrappedLongitude / step) * step),
      ),
    }
  }

  /**
   * The Forecast colouring the Cell that contains this position. `null` when the Cell has No
   * Data — which stays distinct from a real temperature of zero, and is never filled in from a
   * neighbour.
   */
  static findForecast(lookup: CellLookup, latitude: number, longitude: number): Forecast | null {
    const cell = CellLocator.cellFor(lookup, latitude, longitude)
    if (cell === null) {
      return null
    }
    return lookup.forecastsByCell.get(CellLocator.cellKey(cell.latitude, cell.longitude)) ?? null
  }

  private static cellKey(latitude: number, longitude: number): string {
    return `${CellLocator.roundCoordinate(latitude)}|${CellLocator.roundCoordinate(longitude)}`
  }
}
