import { injectable } from 'tsyringe'
import type { StoredGridPoint } from '../../domain/models/grid-point'
import { Clock } from '../../core/clock.service'
import { Env } from '../../core/env.service'
import { HttpClientService } from './http-client.service'

/** Two forecast days at hourly resolution — 48 Forecasts per Grid Point per call. */
const FORECAST_DAYS = 2

/** One hourly Forecast fetched for one Grid Point. `null` is No Data, never zero. */
export interface FetchedForecast {
  readonly gridPointId: number
  readonly validAt: Date
  readonly temperatureCelsius: number | null
}

export interface FetchedForecastWindow {
  readonly forecasts: readonly FetchedForecast[]
  /** The moment these values were retrieved, stamped on every Forecast they produce. */
  readonly fetchedAt: Date
}

/**
 * What it cost is reported as it happens rather than in the result, because a call that ends in
 * a failure still spent Budget — and a Sweep has to record what it spent either way.
 */
export interface FetchForecastsOptions {
  readonly signal?: AbortSignal
  /** Called once per HTTP request issued, retries included. */
  onUpstreamCall?(): void
  /** Called once per Rate Limit response, so the caller can log it against its own Slice. */
  onRateLimited?(): void
}

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

/**
 * The api's one and only door to the upstream weather provider, Open-Meteo. The caller passes
 * the Grid Points it wants and gets Forecasts back; how many go in one call, what the payload
 * looks like, and how it maps to the domain all stay behind here.
 *
 * The provider has no pagination — no cursor, no page, no continuation token — so the only axis
 * for splitting a request is the number of Grid Points in it. Deciding how to split is the
 * caller's job, not this class's.
 *
 * One request asks for an hourly temperature series covering two forecast days, so a single call
 * yields 48 hourly Forecasts per Grid Point. That is what collapses the required Budget:
 * freshness comes from the window, not from sweeping more often.
 */
@injectable()
export class OpenMeteoHttpDataSource {
  constructor(
    private readonly httpClient: HttpClientService,
    private readonly clock: Clock,
  ) {}

  async fetchForecastWindow(
    gridPoints: readonly StoredGridPoint[],
    options?: FetchForecastsOptions,
  ): Promise<FetchedForecastWindow> {
    if (gridPoints.length === 0) {
      return { forecasts: [], fetchedAt: this.clock.now() }
    }

    const body = await this.httpClient.request<unknown>(Env.OPEN_METEO_FORECAST_URL, {
      method: 'GET',
      params: {
        latitude: gridPoints.map((point) => point.latitude).join(','),
        longitude: gridPoints.map((point) => point.longitude).join(','),
        hourly: 'temperature_2m',
        forecast_days: FORECAST_DAYS,
        temperature_unit: 'celsius',
        timeformat: 'iso8601',
        timezone: 'UTC',
      },
      signal: options?.signal,
      observer: {
        onAttempt: () => options?.onUpstreamCall?.(),
        onRateLimited: () => options?.onRateLimited?.(),
      },
    })

    if (isErrorResponse(body)) {
      throw new Error(`The upstream provider returned an error: ${String(body.reason ?? 'unknown')}`)
    }

    return {
      forecasts: OpenMeteoHttpDataSource.toForecasts(gridPoints, body),
      fetchedAt: this.clock.now(),
    }
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
