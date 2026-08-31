import { ForecastValidator } from '../../domain/forecast.validator'
import type { Forecast } from '../../domain/forecast'
import type { Snapshot } from '../../domain/snapshot'

/**
 * The wire contract with Vento's api, duplicated by hand on this side rather than shared
 * through a package — a validator here is what catches drift, since nothing else would.
 */
interface SnapshotForecastBody {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  readonly fetchedAt: string | null
}

interface SnapshotBody {
  readonly validAt: string
  readonly resolutionDegrees: number
  readonly coverage: { readonly total: number; readonly withData: number }
  readonly sweep: { readonly status: string | null; readonly completedAt: string | null }
  readonly forecasts: readonly SnapshotForecastBody[]
}

const MALFORMED_RESPONSE_MESSAGE =
  'A resposta da API de temperatura veio em um formato inesperado. Nenhum dado foi exibido.'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

/**
 * Turns a response body into a Snapshot, or throws. A malformed response becomes a stated error
 * rather than a broken render: half-understood data on the globe would be indistinguishable
 * from real temperature.
 */
export class SnapshotResponseValidator {
  static toSnapshot(body: unknown): Snapshot {
    if (!SnapshotResponseValidator.isSnapshotBody(body)) {
      throw new Error(MALFORMED_RESPONSE_MESSAGE)
    }

    const forecasts: Forecast[] = body.forecasts.map((forecast) => ({
      latitude: forecast.latitude,
      longitude: forecast.longitude,
      temperatureCelsius: forecast.temperatureCelsius,
      validAt: body.validAt,
    }))

    if (!forecasts.every((forecast) => ForecastValidator.isValidForecast(forecast))) {
      throw new Error(MALFORMED_RESPONSE_MESSAGE)
    }

    return {
      forecasts,
      // The Resolution and the Coverage both come from the response: the backend owns the Grid,
      // and reports how much of it has data rather than leaving this app to count values.
      resolutionDegrees: body.resolutionDegrees,
      coverage: { total: body.coverage.total, withData: body.coverage.withData },
      sweep: { status: body.sweep.status, completedAt: body.sweep.completedAt },
    }
  }

  private static isSnapshotBody(body: unknown): body is SnapshotBody {
    if (!isObject(body)) {
      return false
    }
    if (typeof body.validAt !== 'string') {
      return false
    }
    if (typeof body.resolutionDegrees !== 'number' || body.resolutionDegrees <= 0) {
      return false
    }
    if (
      !isObject(body.coverage) ||
      typeof body.coverage.total !== 'number' ||
      typeof body.coverage.withData !== 'number'
    ) {
      return false
    }
    if (
      !isObject(body.sweep) ||
      !isNullableString(body.sweep.status) ||
      !isNullableString(body.sweep.completedAt)
    ) {
      return false
    }
    if (!Array.isArray(body.forecasts)) {
      return false
    }
    return body.forecasts.every((forecast: unknown) => SnapshotResponseValidator.isForecastBody(forecast))
  }

  private static isForecastBody(forecast: unknown): forecast is SnapshotForecastBody {
    if (!isObject(forecast)) {
      return false
    }
    // No Data is null and must stay null all the way through: a missing field, or anything
    // coerced to a number, would turn an absent temperature into a real one.
    return (
      typeof forecast.latitude === 'number' &&
      typeof forecast.longitude === 'number' &&
      (forecast.temperatureCelsius === null || typeof forecast.temperatureCelsius === 'number') &&
      isNullableString(forecast.fetchedAt)
    )
  }
}
