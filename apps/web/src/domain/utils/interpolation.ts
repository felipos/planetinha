import type { TemperatureGrid } from '../temperature-grid'
import type { TemperatureReading } from '../temperature-reading'

export interface GridLookup {
  readonly cellsByKey: ReadonlyMap<string, TemperatureReading>
  readonly resolutionDegrees: number
}

export interface InterpolatedTemperature {
  readonly temperatureCelsius: number | null
  readonly isInterpolated: boolean
}

const COORD_PRECISION = 4

/**
 * Interpolates over the regular lat/long grid fetched from the temperature data source. Uses
 * IDW (inverse-distance weighting) over the up to 4 neighboring grid points of an arbitrary
 * lat/long — used both to generate the heatmap texture and to look up a clicked point, so both
 * agree on which lat/long corresponds to which point on the sphere. Neighboring points without
 * data (`temperatureCelsius: null`) are excluded from the average; if no neighbor has data, the
 * result is `null` ("no data"), never a made-up value.
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

  static buildGridLookup(grid: TemperatureGrid): GridLookup {
    const cellsByKey = new Map<string, TemperatureReading>()
    for (const reading of grid.readings) {
      cellsByKey.set(TemperatureInterpolator.cellKey(reading.latitude, reading.longitude), reading)
    }
    return { cellsByKey, resolutionDegrees: grid.resolutionDegrees }
  }

  static interpolateTemperatureAt(
    lookup: GridLookup,
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
    let exactReading: TemperatureReading | undefined

    for (const [lat, lon] of candidateCoords) {
      const reading = TemperatureInterpolator.findReading(lookup, lat, lon)
      if (reading === undefined || reading.temperatureCelsius === null) {
        continue
      }
      const distance = TemperatureInterpolator.distanceDegrees(clampedLat, wrappedLon, lat, lon)
      if (distance < 1e-6) {
        exactReading = reading
        break
      }
      const weight = 1 / (distance * distance)
      weightedSum += weight * reading.temperatureCelsius
      weightTotal += weight
    }

    if (exactReading !== undefined) {
      return { temperatureCelsius: exactReading.temperatureCelsius, isInterpolated: false }
    }
    if (weightTotal === 0) {
      return { temperatureCelsius: null, isInterpolated: true }
    }
    return { temperatureCelsius: weightedSum / weightTotal, isInterpolated: true }
  }

  private static cellKey(latitude: number, longitude: number): string {
    return `${TemperatureInterpolator.roundCoord(latitude)}|${TemperatureInterpolator.roundCoord(longitude)}`
  }

  private static findReading(
    lookup: GridLookup,
    latitude: number,
    longitude: number,
  ): TemperatureReading | undefined {
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
