import 'reflect-metadata'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { StoredGridPoint } from '../../src/domain/models/grid-point'
import { AbortErrorDetector } from '../../src/domain/utils/abort-error'
import { Clock } from '../../src/core/clock.service'
import { HttpClient } from '../../src/datasource/http/http-client.service'
import { OpenMeteoHttpDataSource } from '../../src/datasource/http/open-meteo.http.datasource'

const HOURS_IN_WINDOW = 48

const realFetch = globalThis.fetch

function gridPoints(count: number): StoredGridPoint[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index + 1,
    latitude: -90 + index,
    longitude: -180 + index,
    resolutionDegrees: 5,
  }))
}

/** An hourly series covering two forecast days, as the provider returns it: naive UTC hours. */
function hourlySeries(temperature: (hour: number) => number | null): OpenMeteoLocation {
  const time: string[] = []
  const temperature_2m: (number | null)[] = []
  for (let hour = 0; hour < HOURS_IN_WINDOW; hour += 1) {
    const start = new Date('2026-08-31T00:00:00.000Z')
    start.setUTCHours(hour)
    time.push(start.toISOString().slice(0, 16))
    temperature_2m.push(temperature(hour))
  }
  return { hourly: { time, temperature_2m } }
}

interface OpenMeteoLocation {
  readonly hourly: { readonly time: string[]; readonly temperature_2m: (number | null)[] }
}

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  const status = init?.status ?? 200
  const headers = init?.headers ?? {}
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => body,
  } as unknown as Response
}

function createDataSource(): OpenMeteoHttpDataSource {
  return new OpenMeteoHttpDataSource(new HttpClient(), new Clock())
}

describe('OpenMeteoHttpDataSource', () => {
  beforeEach(() => {
    process.env.OPEN_METEO_FORECAST_URL = 'https://upstream.test/v1/forecast'
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    mock.reset()
  })

  it('returns one hourly Forecast series per Grid Point, covering two forecast days', async () => {
    // Arrange
    const points = gridPoints(3)
    globalThis.fetch = mock.fn(async () =>
      jsonResponse(points.map((_point, index) => hourlySeries((hour) => index * 100 + hour))),
    ) as typeof fetch
    let upstreamCalls = 0

    // Act
    const window = await createDataSource().fetchForecastWindow(points, {
      onUpstreamCall: () => {
        upstreamCalls += 1
      },
    })

    // Assert
    assert.equal(window.forecasts.length, points.length * HOURS_IN_WINDOW)
    assert.equal(upstreamCalls, 1)
    const hours = window.forecasts.filter((forecast) => forecast.gridPointId === 1)
    assert.equal(hours.length, HOURS_IN_WINDOW)
    // 48 consecutive hours, so the window runs into the second forecast day.
    assert.equal(hours[0]?.validAt.toISOString(), '2026-08-31T00:00:00.000Z')
    assert.equal(hours[47]?.validAt.toISOString(), '2026-09-01T23:00:00.000Z')
  })

  it('aligns the hourly arrays positionally to the coordinates sent, over a Slice of 100', async () => {
    // Arrange
    const points = gridPoints(100)
    let requestedUrl = ''
    globalThis.fetch = mock.fn(async (url: string | URL) => {
      requestedUrl = String(url)
      // The i-th location's whole series is the i-th Grid Point's id, so a misalignment by even
      // one position shows up as the wrong Grid Point carrying the wrong values.
      return jsonResponse(points.map((point) => hourlySeries(() => point.id)))
    }) as typeof fetch

    // Act
    const window = await createDataSource().fetchForecastWindow(points)

    // Assert
    const sentLatitudes = new URL(requestedUrl).searchParams.get('latitude')?.split(',') ?? []
    assert.equal(sentLatitudes.length, 100)
    assert.equal(sentLatitudes[0], String(points[0]?.latitude))
    assert.equal(sentLatitudes[99], String(points[99]?.latitude))
    assert.equal(window.forecasts.length, 100 * HOURS_IN_WINDOW)
    assert.ok(
      window.forecasts.every((forecast) => forecast.temperatureCelsius === forecast.gridPointId),
      'every Forecast belongs to the Grid Point whose position it was returned in',
    )
  })

  it('maps a null temperature in the series to No Data and never to zero', async () => {
    // Arrange
    const points = gridPoints(1)
    globalThis.fetch = mock.fn(async () =>
      jsonResponse([hourlySeries((hour) => (hour === 3 ? null : 0))]),
    ) as typeof fetch

    // Act
    const window = await createDataSource().fetchForecastWindow(points)

    // Assert
    assert.equal(window.forecasts[3]?.temperatureCelsius, null)
    // A real zero elsewhere in the same series survives as a temperature.
    assert.equal(window.forecasts[4]?.temperatureCelsius, 0)
    assert.equal(window.forecasts.filter((forecast) => forecast.temperatureCelsius === null).length, 1)
  })

  it('surfaces a provider error body as a failure with a readable message, never as data', async () => {
    // Arrange
    globalThis.fetch = mock.fn(async () =>
      jsonResponse({ error: true, reason: 'Latitude must be in range of -90 to 90°.' }),
    ) as typeof fetch

    // Act
    const resultPromise = createDataSource().fetchForecastWindow(gridPoints(1))

    // Assert
    await assert.rejects(resultPromise, /Latitude must be in range/)
  })

  it('retries a Rate Limit response with backoff and reports the hit', async () => {
    // Arrange
    const points = gridPoints(1)
    let calls = 0
    globalThis.fetch = mock.fn(async () => {
      calls += 1
      if (calls === 1) {
        return jsonResponse(null, { status: 429, headers: { 'Retry-After': '0' } })
      }
      return jsonResponse([hourlySeries(() => 7)])
    }) as typeof fetch
    let observedRateLimits = 0
    let upstreamCalls = 0

    // Act
    const window = await createDataSource().fetchForecastWindow(points, {
      onUpstreamCall: () => {
        upstreamCalls += 1
      },
      onRateLimited: () => {
        observedRateLimits += 1
      },
    })

    // Assert
    assert.equal(calls, 2)
    assert.equal(observedRateLimits, 1)
    // Both attempts count as upstream calls: a retry is another call against the Budget.
    assert.equal(upstreamCalls, 2)
    assert.ok(window.forecasts.every((forecast) => forecast.temperatureCelsius === 7))
  })

  it('interrupts an in-flight request and its backoff wait when aborted', async () => {
    // Arrange
    const controller = new AbortController()
    globalThis.fetch = mock.fn(async (_url: string | URL, init?: RequestInit) => {
      // A 429 with a long Retry-After parks the client in a backoff wait, which the abort must
      // cut short rather than leaving it to run out.
      init?.signal?.throwIfAborted()
      return jsonResponse(null, { status: 429, headers: { 'Retry-After': '600' } })
    }) as typeof fetch

    // Act
    const resultPromise = createDataSource().fetchForecastWindow(gridPoints(1), {
      signal: controller.signal,
    })
    controller.abort()

    // Assert
    const error = await resultPromise.catch((caught: unknown) => caught)
    assert.ok(AbortErrorDetector.isAbortError(error))
  })
})
