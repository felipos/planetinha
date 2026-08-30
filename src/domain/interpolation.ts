import type { TemperatureGrid } from './temperature-grid'
import type { TemperatureReading } from './temperature-reading'

/**
 * Interpolação sobre a grade regular lat/long buscada do Open-Meteo (ver research.md §4).
 * Usa IDW (inverse-distance weighting) sobre os até 4 pontos de grade vizinhos de um lat/long
 * arbitrário — usado tanto para gerar a textura do heatmap quanto para o lookup de um ponto
 * clicado (US3). Pontos vizinhos sem dado (`temperatureCelsius: null`) são excluídos da média;
 * se nenhum vizinho tiver dado, o resultado é `null` ("sem dado"), nunca um valor inventado.
 */

export interface GridLookup {
  readonly cellsByKey: ReadonlyMap<string, TemperatureReading>
  readonly resolutionDegrees: number
}

export interface InterpolatedTemperature {
  readonly temperatureCelsius: number | null
  readonly isInterpolated: boolean
}

const COORD_PRECISION = 4

export function roundCoord(value: number): number {
  const factor = 10 ** COORD_PRECISION
  return Math.round(value * factor) / factor
}

function cellKey(latitude: number, longitude: number): string {
  return `${roundCoord(latitude)}|${roundCoord(longitude)}`
}

export function wrapLongitude(longitude: number): number {
  let wrapped = longitude
  while (wrapped < -180) {
    wrapped += 360
  }
  while (wrapped >= 180) {
    wrapped -= 360
  }
  return wrapped
}

function angularLongitudeDelta(a: number, b: number): number {
  return wrapLongitude(a - b)
}

function distanceDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat1 - lat2
  const dLon = angularLongitudeDelta(lon1, lon2)
  return Math.sqrt(dLat * dLat + dLon * dLon)
}

export function buildGridLookup(grid: TemperatureGrid): GridLookup {
  const cellsByKey = new Map<string, TemperatureReading>()
  for (const reading of grid.readings) {
    cellsByKey.set(cellKey(reading.latitude, reading.longitude), reading)
  }
  return { cellsByKey, resolutionDegrees: grid.resolutionDegrees }
}

function findReading(
  lookup: GridLookup,
  latitude: number,
  longitude: number,
): TemperatureReading | undefined {
  return lookup.cellsByKey.get(cellKey(latitude, wrapLongitude(longitude)))
}

export function interpolateTemperatureAt(
  lookup: GridLookup,
  latitude: number,
  longitude: number,
): InterpolatedTemperature {
  const step = lookup.resolutionDegrees
  if (step <= 0) {
    return { temperatureCelsius: null, isInterpolated: false }
  }

  const clampedLat = Math.min(Math.max(latitude, -90), 90)
  const wrappedLon = wrapLongitude(longitude)

  const latFloorRaw = Math.floor((clampedLat + 90) / step) * step - 90
  const latFloor = Math.min(Math.max(latFloorRaw, -90), 90 - step)
  const latCeil = Math.min(latFloor + step, 90)
  const lonFloor = wrapLongitude(Math.floor((wrappedLon + 180) / step) * step - 180)
  const lonCeil = wrapLongitude(lonFloor + step)

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
    const reading = findReading(lookup, lat, lon)
    if (reading === undefined || reading.temperatureCelsius === null) {
      continue
    }
    const distance = distanceDegrees(clampedLat, wrappedLon, lat, lon)
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
