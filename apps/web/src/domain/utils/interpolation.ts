import type { Snapshot } from '../snapshot'
import type { Forecast } from '../forecast'

export interface CellLookup {
  readonly cellsByKey: ReadonlyMap<string, Forecast>
  readonly resolutionDegrees: number
}

export interface InterpolatedTemperature {
  readonly temperatureCelsius: number | null
  readonly isInterpolated: boolean
}

const COORD_PRECISION = 4

/**
 * Interpolates over the Grid a Snapshot's Forecasts sit on. Uses IDW (inverse-distance
 * weighting) over the up to 4 neighbouring Grid Points of an arbitrary lat/long — used both to
 * generate the heatmap texture and to look up a clicked point, so both agree on which lat/long
 * corresponds to which point on the sphere. Neighbouring Grid Points with No Data
 * (`temperatureCelsius: null`) are excluded from the average; if no neighbour has a
 * temperature, the result is `null` (No Data), never a made-up value.
 */
export class TemperatureInterpolator {
  static roundCoord(value: number): number {
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

  static buildCellLookup(snapshot: Snapshot): CellLookup {
    const cellsByKey = new Map<string, Forecast>()
    for (const forecast of snapshot.forecasts) {
      cellsByKey.set(TemperatureInterpolator.cellKey(forecast.latitude, forecast.longitude), forecast)
    }
    return { cellsByKey, resolutionDegrees: snapshot.resolutionDegrees }
  }

  static interpolateTemperatureAt(
    lookup: CellLookup,
    latitude: number,
    longitude: number,
  ): InterpolatedTemperature {
    const step = lookup.resolutionDegrees
    if (step <= 0) {
      return { temperatureCelsius: null, isInterpolated: false }
    }

    const clampedLat = Math.min(Math.max(latitude, -90), 90)
    const wrappedLon = TemperatureInterpolator.wrapLongitude(longitude)

    const latFloorRaw = Math.floor((clampedLat + 90) / step) * step - 90
    const latFloor = Math.min(Math.max(latFloorRaw, -90), 90 - step)
    const latCeil = Math.min(latFloor + step, 90)
    const lonFloor = TemperatureInterpolator.wrapLongitude(Math.floor((wrappedLon + 180) / step) * step - 180)
    const lonCeil = TemperatureInterpolator.wrapLongitude(lonFloor + step)

    const candidateCoords: ReadonlyArray<readonly [number, number]> = [
      [latFloor, lonFloor],
      [latFloor, lonCeil],
      [latCeil, lonFloor],
      [latCeil, lonCeil],
    ]

    let weightedSum = 0
    let weightTotal = 0
    let exactForecast: Forecast | undefined

    for (const [lat, lon] of candidateCoords) {
      const forecast = TemperatureInterpolator.findForecast(lookup, lat, lon)
      if (forecast === undefined || forecast.temperatureCelsius === null) {
        continue
      }
      const distance = TemperatureInterpolator.distanceDegrees(clampedLat, wrappedLon, lat, lon)
      if (distance < 1e-6) {
        exactForecast = forecast
        break
      }
      const weight = 1 / (distance * distance)
      weightedSum += weight * forecast.temperatureCelsius
      weightTotal += weight
    }

    if (exactForecast !== undefined) {
      return { temperatureCelsius: exactForecast.temperatureCelsius, isInterpolated: false }
    }
    if (weightTotal === 0) {
      return { temperatureCelsius: null, isInterpolated: true }
    }
    return { temperatureCelsius: weightedSum / weightTotal, isInterpolated: true }
  }

  private static cellKey(latitude: number, longitude: number): string {
    return `${TemperatureInterpolator.roundCoord(latitude)}|${TemperatureInterpolator.roundCoord(longitude)}`
  }

  private static findForecast(lookup: CellLookup, latitude: number, longitude: number): Forecast | undefined {
    return lookup.cellsByKey.get(
      TemperatureInterpolator.cellKey(latitude, TemperatureInterpolator.wrapLongitude(longitude)),
    )
  }

  private static distanceDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = lat1 - lat2
    const dLon = TemperatureInterpolator.wrapLongitude(lon1 - lon2)
    return Math.sqrt(dLat * dLat + dLon * dLon)
  }
}
