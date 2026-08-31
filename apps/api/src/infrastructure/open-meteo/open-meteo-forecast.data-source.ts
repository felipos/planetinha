import { injectable } from 'tsyringe'
import type {
  FetchForecastsOptions,
  FetchedForecast,
  FetchedForecastWindow,
  ForecastSourcePort,
} from '../../application/ports/forecast-source.port'
import type { StoredGridPoint } from '../../domain/grid-point'
import { Clock } from '../clock.service'
import { Env } from '../env.service'
import { HttpClient } from '../http-client.service'

/**
 * Concrete `ForecastSourcePort` for the Open-Meteo public API.
 *
 * One request asks for an hourly temperature series covering two forecast days, so a single
 * call yields 48 hourly Forecasts per Grid Point. That is what collapses the required Budget:
 * freshness comes from the window, not from sweeping more often.
 */

/** Two forecast days at hourly resolution — 48 Forecasts per Grid Point per call. */
const FORECAST_DAYS = 2

interface OpenMeteoHourlyBlock {
  readonly time?: readonly string[]
  readonly temperature_2m?: readonly (number | null)[]
}

interface OpenMeteoLocationResponse {
  readonly hourly?: OpenMeteoHourlyBlock
}

interface OpenMeteoErrorResponse {
  readonly error?: boolean
  readonly reason?: unknown
}

function isErrorResponse(body: unknown): body is OpenMeteoErrorResponse {
  return typeof body === 'object' && body !== null && (body as OpenMeteoErrorResponse).error === true
}

/**
 * The provider returns local-naive timestamps (`2026-08-31T09:00`) alongside a UTC offset, and
 * the request pins that offset to zero — so an hour is read as UTC rather than as whatever
 * timezone the process happens to run in.
 */
function parseUtcHour(time: string): Date {
  return new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(time) ? time : `${time}Z`)
}

@injectable()
export class OpenMeteoForecastDataSource implements ForecastSourcePort {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly clock: Clock,
  ) {}

  async fetchForecastWindow(
    gridPoints: readonly StoredGridPoint[],
    options?: FetchForecastsOptions,
  ): Promise<FetchedForecastWindow> {
    if (gridPoints.length === 0) {
      return { forecasts: [], fetchedAt: this.clock.now() }
    }

    const body = await this.httpClient.getJson<unknown>(
      OpenMeteoForecastDataSource.buildRequestUrl(gridPoints),
      {
        signal: options?.signal,
        observer: {
          onAttempt: () => options?.onUpstreamCall?.(),
          onRateLimited: () => options?.onRateLimited?.(),
        },
      },
    )

    if (isErrorResponse(body)) {
      throw new Error(`The upstream provider returned an error: ${String(body.reason ?? 'unknown')}`)
    }

    return {
      forecasts: OpenMeteoForecastDataSource.toForecasts(gridPoints, body),
      fetchedAt: this.clock.now(),
    }
  }

  private static buildRequestUrl(gridPoints: readonly StoredGridPoint[]): string {
    const params = new URLSearchParams({
      latitude: gridPoints.map((point) => point.latitude).join(','),
      longitude: gridPoints.map((point) => point.longitude).join(','),
      hourly: 'temperature_2m',
      forecast_days: String(FORECAST_DAYS),
      temperature_unit: 'celsius',
      timeformat: 'iso8601',
      timezone: 'UTC',
    })
    return `${Env.OPEN_METEO_FORECAST_URL}?${params.toString()}`
  }

  /**
   * The provider has no key linking a result back to what was asked for: a multi-location
   * response is an array aligned positionally to the comma-separated coordinates that were
   * sent. Index i belongs to Grid Point i, and nothing else says so.
   */
  private static toForecasts(
    gridPoints: readonly StoredGridPoint[],
    body: unknown,
  ): readonly FetchedForecast[] {
    const locations: readonly OpenMeteoLocationResponse[] = Array.isArray(body)
      ? (body as OpenMeteoLocationResponse[])
      : [body as OpenMeteoLocationResponse]

    const forecasts: FetchedForecast[] = []
    gridPoints.forEach((gridPoint, index) => {
      const hourly = locations[index]?.hourly
      const times = hourly?.time ?? []
      const temperatures = hourly?.temperature_2m ?? []

      times.forEach((time, hour) => {
        const temperature = temperatures[hour]
        forecasts.push({
          gridPointId: gridPoint.id,
          validAt: parseUtcHour(time),
          // A null anywhere in the series is No Data for that hour, and must never become zero.
          temperatureCelsius: typeof temperature === 'number' ? temperature : null,
        })
      })
    })

    return forecasts
  }
}
